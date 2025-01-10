import { Entity } from "@/entity";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { getTopic, TopicType } from "@/payload/topic";
import { Alive } from "@/service/alive";
import initializeMqttClient from "@/service/mqtt";
import { startup } from "@/service/startup";
import { suspend } from "@/service/suspend";
import env from "env-var";

const HA_DISCOVERY_PREFIX = env
  .get("HA_DISCOVERY_PREFIX")
  .default("homeassistant")
  .asString(); // ON/OFF切り替え後、状態の更新を止める時間
const STATE_CHANGE_PAUSE_DURATION = env
  .get("STATE_CHANGE_PAUSE_DURATION")
  .default(30000)
  .asInt();

export default async function setupMqttDeviceManager(
  deviceId: string,
  entities: Entity[],
  alives: Map<string, Alive>,
) {
  const origin = await buildOrigin();
  const device = buildDevice(deviceId);
  const lastStateChangeTimes = new Map<string, number>();

  // 受信して状態を変更
  const handleMessage = async (topic: string, message: string) => {
    const entity = entities.find(
      (entity) => getTopic(entity, TopicType.COMMAND) === topic,
    );
    if (!entity) return;

    const { lastAlive } = alives.get(entity.id)!;
    const now = Date.now();

    if (message === StatusMessage.ON && !lastAlive) {
      lastStateChangeTimes.set(entity.id, now);
      await startup(entity.remote);
    } else if (message === StatusMessage.OFF && lastAlive) {
      lastStateChangeTimes.set(entity.id, now);
      await suspend(entity.remote);
    }
  };

  const subscribeTopics = entities.map((entity) =>
    getTopic(entity, TopicType.COMMAND),
  );

  const mqtt = await initializeMqttClient(subscribeTopics, handleMessage);

  entities.forEach((entity) => {
    const publishState = (value: boolean) =>
      mqtt.publish(
        getTopic(entity, TopicType.STATE),
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
        Date.now() - lastStateChangeTime > STATE_CHANGE_PAUSE_DURATION
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
      `${HA_DISCOVERY_PREFIX}/switch/${discoveryMessage.unique_id}/config`,
      JSON.stringify(discoveryMessage),
      { qos: 1, retain: true },
    );
  });

  return mqtt;
}
