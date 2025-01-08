import { Entity } from "@/entity";
import logger from "@/logger";
import { requestAlive } from "@/operation/alive";
import { startup } from "@/operation/startup";
import { suspend } from "@/operation/suspend";
import { buildDevice, buildEntity, buildOrigin } from "@/payload/builder";
import { getTopic, TopicType } from "@/payload/topic";
import env from "env-var";
import fs from "fs/promises";
import http from "http";
import mqtt from "mqtt";
import { promisify } from "util";

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
const PORT = env.get("PORT").default(3000).asPortNumber();
const MQTT_BROKER = env.get("MQTT_BROKER").required().asString();
const MQTT_USERNAME = env.get("MQTT_USERNAME").asString();
const MQTT_PASSWORD = env.get("MQTT_PASSWORD").asString();
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

  const client = await mqtt.connectAsync(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  logger.info("[MQTT] connected");

  await client.subscribeAsync(
    entities.map((entity) => getTopic(entity, TopicType.COMMAND)),
  );

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
  client.on("message", (topic, payload) => {
    void handleMessage(topic, payload.toString());
  });

  await Promise.all(
    entities.map(async (entity) => {
      const publishState = (value: boolean) =>
        client.publishAsync(
          getTopic(entity, TopicType.STATE),
          value ? StatusMessage.ON : StatusMessage.OFF,
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
      await client.publishAsync(
        `${HA_DISCOVERY_PREFIX}/switch/${discoveryMessage.unique_id}/config`,
        JSON.stringify(discoveryMessage),
        { retain: true },
      );
    }),
  );

  const publishAvailability = (value: string) =>
    Promise.all(
      entities.map((entity) =>
        client.publishAsync(getTopic(entity, TopicType.AVAILABILITY), value),
      ),
    );

  // オンライン状態を定期的に送信
  const availabilityTimerId = setInterval(
    () => void publishAvailability("online"),
    AVAILABILITY_INTERVAL,
  );

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({}));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await promisify(server.listen.bind(server, PORT))();
  logger.info(`Health check server running on port ${PORT}`);

  const shutdownHandler = async () => {
    logger.info("shutdown");
    await promisify(server.close.bind(server))();
    logger.info("[HTTP] closed");
    alives.forEach((alive) => alive.close());
    clearInterval(availabilityTimerId);
    await publishAvailability("offline");
    await client.endAsync();
    logger.info("[MQTT] closed");
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
