import { Entity } from "@/entity";
import logger from "@/logger";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import { getTopic, TopicType } from "@/payload/topic";
import { requestAlive } from "@/service/alive";
import initializeHttpServer from "@/service/http";
import env from "env-var";
import fs from "fs/promises";

type Config = {
  deviceId: string;
  entities: Entity[];
};

const AVAILABILITY_INTERVAL = env
  .get("AVAILABILITY_INTERVAL")
  .default(10000)
  .asIntPositive();
// 状態を確認する間隔
const CHECK_ALIVE_INTERVAL = env
  .get("CHECK_ALIVE_INTERVAL")
  .default(5000)
  .asInt();

async function main() {
  logger.info("start");

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as Config;
  const alives = new Map(
    await Promise.all(
      entities.map(async ({ id: uniqueId, remote }) => {
        const alive = await requestAlive(remote, CHECK_ALIVE_INTERVAL);
        return [uniqueId, alive] as const;
      }),
    ),
  );
  const mqtt = await setupMqttDeviceManager(deviceId, entities, alives);
  const http = await initializeHttpServer();

  http.setEndpoint("/health", () => ({}));

  const publishAvailability = (value: string) => {
    entities.forEach((entity) => {
      mqtt.publish(getTopic(entity, TopicType.AVAILABILITY), value);
    });
  };

  // オンライン状態を定期的に送信
  const availabilityTimerId = setInterval(
    () => void publishAvailability("online"),
    AVAILABILITY_INTERVAL,
  );

  const shutdownHandler = async () => {
    logger.info("shutdown");
    alives.forEach((alive) => alive.close());
    clearInterval(availabilityTimerId);
    publishAvailability("offline");
    await mqtt.close(true);
    await http.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdownHandler());
  process.on("SIGTERM", () => void shutdownHandler());

  publishAvailability("online");

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
