import mqtt from "mqtt";
import env from "env-var";
import fs from "fs/promises";
import { Config as SSHConfig } from "node-ssh";
import { startup } from "./operation/startup";
import { suspend } from "./operation/suspend";
import { requestAlive } from "./operation/alive";

export type RemoteConfig = {
  ssh: SSHConfig;
  macAddress: string;
  ipAddress: string;
  subnetMask?: string;
};

type Config = {
  deviceId: string;
  entities: Entity[];
};

type Entity = {
  id: string;
  name: string;
  remote: RemoteConfig;
};

const TopicType = {
  COMMAND: "set",
  STATE: "state",
  AVAILABILITY: "availability",
} as const;
type TopicType = (typeof TopicType)[keyof typeof TopicType];

const StatusMessage = {
  ON: "ON",
  OFF: "OFF",
} as const;
type StatusMessage = (typeof StatusMessage)[keyof typeof StatusMessage];

function getTopic(device: Entity, type: TopicType): string {
  return `pc2mqtt/${device.id}/${type}`;
}

async function main() {
  console.log("pc2mqtt: start");

  const haDiscoveryPrefix = env
    .get("HA_DISCOVERY_PREFIX")
    .default("homeassistant")
    .asString();
  // 状態を確認する間隔
  const checkAliveInterval = env
    .get("CHECK_ALIVE_INTERVAL")
    .default(5000)
    .asInt();
  // ON/OFF切り替え後、状態の更新を止める時間
  const stateChangePauseDuration = env
    .get("STATE_CHANGE_PAUSE_DURATION")
    .default(30000)
    .asInt();

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as Config;

  const getDiscoveryMessage = (entity: Entity) => {
    return {
      unique_id: `pc2mqtt_${deviceId}_${entity.id}`,
      name: entity.name,
      command_topic: getTopic(entity, TopicType.COMMAND),
      state_topic: getTopic(entity, TopicType.STATE),
      availability_topic: getTopic(entity, TopicType.AVAILABILITY),
      optimistic: true,
      device: {
        identifiers: [`pc2mqtt_${deviceId}`],
        name: `pc2mqtt.${deviceId}`,
        model: "pc2mqtt",
        manufacturer: "nana4rider",
      },
      origin: {
        name: "pc2mqtt",
        sw_version: "1.0.0",
        support_url: "https://github.com/nana4rider/pc2mqtt",
      },
    };
  };

  const client = await mqtt.connectAsync(
    env.get("MQTT_BROKER").required().asString(),
    {
      username: env.get("MQTT_USERNAME").asString(),
      password: env.get("MQTT_PASSWORD").asString(),
    },
  );

  console.log("mqtt-client: connected");

  await client.subscribeAsync(
    entities.map((entity) => getTopic(entity, TopicType.COMMAND)),
  );

  const alives = new Map(
    await Promise.all(
      entities.map(async ({ id: uniqueId, remote }) => {
        const alive = await requestAlive(remote, checkAliveInterval);
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
          Date.now() - lastStateChangeTime > stateChangePauseDuration
        ) {
          void publishState(isAlive);
        }
      });
      // 起動時に送信
      await publishState(alive.lastAlive);
      // Home Assistantでデバイスを検出
      const discoveryMessage = getDiscoveryMessage(entity);
      await client.publishAsync(
        `${haDiscoveryPrefix}/switch/${discoveryMessage.unique_id}/config`,
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
    env.get("AVAILABILITY_INTERVAL").default(10000).asIntPositive(),
  );

  const shutdownHandler = async () => {
    console.log("pc2mqtt: shutdown");
    alives.forEach((alive) => alive.close());
    clearInterval(availabilityTimerId);
    await publishAvailability("offline");
    await client.endAsync();
    console.log("mqtt-client: closed");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdownHandler());
  process.on("SIGTERM", () => void shutdownHandler());

  await publishAvailability("online");

  console.log("pc2mqtt: ready");
}

// https://github.com/steelbrain/node-ssh/issues/421
process.on("uncaughtException", (reason, promise) => {
  console.error("Uncaught Exception at:", promise, "reason:", reason);
});

main().catch((error) => {
  console.error("pc2mqtt:", error);
  process.exit(1);
});
