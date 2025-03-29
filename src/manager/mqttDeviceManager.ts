import type { Entity } from "@/entity";
import env from "@/env";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { getTopic, TopicType } from "@/payload/topic";
import type { Alive } from "@/service/alive";
import initializeMqttClient from "@/service/mqtt";
import shutdown from "@/service/shutdown";
import startup from "@/service/startup";

export default async function setupMqttDeviceManager(
  deviceId: string,
  entities: Entity[],
  alives: Map<string, Alive>,
) {
  const origin = buildOrigin();
  const device = buildDevice(deviceId);
  const lastStateChangeTimes = new Map<string, number>();

  // 受信して状態を変更
  const handleMessage = async (topic: string, message: string) => {
    const entity = entities.find(
      (entity) => getTopic(deviceId, entity, TopicType.COMMAND) === topic,
    );
    if (!entity) return;

    const { lastAlive } = alives.get(entity.id)!;
    const now = Date.now();

    if (message === StatusMessage.ON && !lastAlive) {
      lastStateChangeTimes.set(entity.id, now);
      await startup(entity.remote);
    } else if (message === StatusMessage.OFF && lastAlive) {
      lastStateChangeTimes.set(entity.id, now);
      await shutdown(entity.remote);
    }
  };

  const subscribeTopics = entities.map((entity) =>
    getTopic(deviceId, entity, TopicType.COMMAND),
  );

  const mqtt = await initializeMqttClient(subscribeTopics, handleMessage);

  entities.forEach((entity) => {
    const publishState = (value: boolean) =>
      mqtt.publish(
        getTopic(deviceId, entity, TopicType.STATE),
        value ? StatusMessage.ON : StatusMessage.OFF,
        // 定期的に状態を送信するのでretainは付与しない
        { retain: false },
      );
    const alive = alives.get(entity.id)!;
    // 状態の変更を検知して送信
    alive.addListener((isAlive) => {
      const lastStateChangeTime = lastStateChangeTimes.get(entity.id);
      // ON/OFFがすぐに反映されないので、一定時間状態の変更を通知しない
      if (
        !lastStateChangeTime ||
        Date.now() - lastStateChangeTime > env.STATE_CHANGE_PAUSE_DURATION
      ) {
        void publishState(isAlive);
      }
    });
    // 起動時に送信
    publishState(alive.lastAlive);
    // Home Assistantでデバイスを検出
    const discoveryMessage = {
      ...buildEntity(deviceId, entity),
      ...device,
      ...origin,
    };
    mqtt.publish(
      `${env.HA_DISCOVERY_PREFIX}/switch/${discoveryMessage.unique_id}/config`,
      JSON.stringify(discoveryMessage),
      { qos: 1, retain: true },
    );
  });

  return mqtt;
}
