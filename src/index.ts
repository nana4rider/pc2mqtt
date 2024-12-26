import mqtt from "mqtt";
import env from "env-var";
import fs from "fs/promises";
import { remoteCommand, RemoteConfig } from "./remote";

type Config = {
  deviceId: string;
  entities: Entity[];
};

type Entity = {
  uniqueId: string;
  name: string;
  remote: RemoteConfig;
};

enum TopicType {
  COMMAND = "set",
  STATE = "state",
  AVAILABILITY = "availability",
}

enum StatusMessage {
  ON = "ON",
  OFF = "OFF",
}

function getTopic(device: Entity, type: TopicType): string {
  return `pc2mqtt/${device.uniqueId}/${type}`;
}

async function main() {
  console.log("pc2mqtt: start");

  const haDiscoveryPrefix = env
    .get("HA_DISCOVERY_PREFIX")
    .default("homeassistant")
    .asString();

  const { deviceId, entities }: Config = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  );

  const getDiscoveryMessage = (entity: Entity): string => {
    return JSON.stringify({
      unique_id: entity.uniqueId,
      name: entity.name,
      command_topic: getTopic(entity, TopicType.COMMAND),
      state_topic: getTopic(entity, TopicType.STATE),
      availability_topic: getTopic(entity, TopicType.AVAILABILITY),
      optimistic: false,
      retain: true,
      device: {
        identifiers: [deviceId],
        name: `pc2mqtt.${deviceId}`,
        model: "pc2mqtt",
        manufacturer: "nana4rider",
      },
    });
  };

  const remotes = entities.map(({ remote }) => remoteCommand(remote));

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

  // 受信して状態を変更
  client.on("message", async (topic, payload) => {
    const entityIndex = entities.findIndex(
      (entity) => getTopic(entity, TopicType.COMMAND) === topic,
    );
    if (entityIndex === -1) return;

    const message = payload.toString();
    const remote = remotes[entityIndex];
    const running = await remote.isRunning();

    if (message === StatusMessage.ON && !running) {
      await remote.startup();
    } else if (message === StatusMessage.OFF && running) {
      await remote.shutdown();
    }
  });

  entities.map(async (entity) => {
    // Home Assistantでデバイスを検出
    await client.publishAsync(
      `${haDiscoveryPrefix}/switch/${deviceId}/${entity.uniqueId}/config`,
      getDiscoveryMessage(entity),
      { retain: true },
    );
  });

  const publishState = () =>
    Promise.all(
      entities.map(async (entity, index) => {
        const running = await remotes[index].isRunning();
        await client.publishAsync(
          getTopic(entity, TopicType.STATE),
          running ? StatusMessage.ON : StatusMessage.OFF,
        );
      }),
    );

  // チェック結果を定期的に送信
  const checkRunningTimerId = setInterval(
    publishState,
    env.get("CHECK_RUNNING_INTERVAL").default(10000).asIntPositive(),
  );

  const publishAvailability = (value: string) =>
    Promise.all(
      entities.map((entity) =>
        client.publishAsync(getTopic(entity, TopicType.AVAILABILITY), value),
      ),
    );

  // オンライン状態を定期的に送信
  const availabilityTimerId = setInterval(
    () => publishAvailability("online"),
    env.get("AVAILABILITY_INTERVAL").default(10000).asIntPositive(),
  );

  const shutdownHandler = async () => {
    console.log("pc2mqtt: shutdown");
    clearInterval(checkRunningTimerId);
    clearInterval(availabilityTimerId);
    await publishAvailability("offline");
    await client.endAsync();
    console.log("mqtt-client: closed");
    process.exit(0);
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);

  await publishState();
  await publishAvailability("online");

  console.log("pc2mqtt: ready");
}

main().catch((error) => {
  console.error("pc2mqtt:", error);
  process.exit(1);
});
