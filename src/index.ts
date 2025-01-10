import { Entity } from "@/entity";
import logger from "@/logger";
import { buildDevice, buildEntity, buildOrigin } from "@/payload/builder";
import { getTopic, TopicType } from "@/payload/topic";
import { requestAlive } from "@/service/alive";
import initializeHttpServer from "@/service/http";
import initializeMqttClient from "@/service/mqtt";
import { startup } from "@/service/startup";
import { suspend } from "@/service/suspend";
import env from "env-var";
import fs from "fs/promises";

type Config = {
  deviceId: string;
  entities: Entity[];
};

const StatusMessage = {
  ON: "ON",
  OFF: "OFF",
} as const;
type StatusMessage = (typeof StatusMessage)[keyof typeof StatusMessage];

const HA_DISCOVERY_PREFIX = env
  .get("HA_DISCOVERY_PREFIX")
  .default("homeassistant")
  .asString();
const AVAILABILITY_INTERVAL = env
  .get("AVAILABILITY_INTERVAL")
  .default(10000)
  .asIntPositive();
// 状態を確認する間隔
const CHECK_ALIVE_INTERVAL = env
  .get("CHECK_ALIVE_INTERVAL")
  .default(5000)
  .asInt();
// ON/OFF切り替え後、状態の更新を止める時間
const STATE_CHANGE_PAUSE_DURATION = env
  .get("STATE_CHANGE_PAUSE_DURATION")
  .default(30000)
  .asInt();

async function main() {
  logger.info("start");

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as Config;

  const origin = await buildOrigin();
  const device = buildDevice(deviceId);

  const alives = new Map(
    await Promise.all(
      entities.map(async ({ id: uniqueId, remote }) => {
        const alive = await requestAlive(remote, CHECK_ALIVE_INTERVAL);
        return [uniqueId, alive] as const;
      }),
    ),
  );
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

  await Promise.all(
    entities.map(async (entity) => {
      const publishState = (value: boolean) =>
        mqtt.publish(
          getTopic(entity, TopicType.STATE),
          value ? StatusMessage.ON : StatusMessage.OFF,
          // 定期的に状態を送信するのでretainは付与しない
          false,
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
      await publishState(alive.lastAlive);
      // Home Assistantでデバイスを検出
      const discoveryMessage = {
        ...buildEntity(deviceId, entity),
        ...device,
        ...origin,
      };
      await mqtt.publish(
        `${HA_DISCOVERY_PREFIX}/switch/${discoveryMessage.unique_id}/config`,
        JSON.stringify(discoveryMessage),
        true,
      );
    }),
  );

  const publishAvailability = (value: string) =>
    Promise.all(
      entities.map((entity) =>
        mqtt.publish(getTopic(entity, TopicType.AVAILABILITY), value),
      ),
    );

  // オンライン状態を定期的に送信
  const availabilityTimerId = setInterval(
    () => void publishAvailability("online"),
    AVAILABILITY_INTERVAL,
  );

  const http = await initializeHttpServer();
  http.setEndpoint("/health", () => ({}));

  const shutdownHandler = async () => {
    logger.info("shutdown");
    alives.forEach((alive) => alive.close());
    clearInterval(availabilityTimerId);
    await publishAvailability("offline");
    await mqtt.close();
    await http.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdownHandler());
  process.on("SIGTERM", () => void shutdownHandler());

  await publishAvailability("online");

  logger.info("ready");
}

process.on("uncaughtException", (reason) => {
  if (reason.message.includes("ECONNRESET")) {
    // https://github.com/steelbrain/node-ssh/issues/421
    logger.debug("Uncaught Exception at:", reason);
  } else {
    throw reason;
  }
});

try {
  await main();
} catch (err) {
  logger.error("main() error:", err);
  process.exit(1);
}
