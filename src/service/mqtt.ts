import logger from "@/logger";
import env from "env-var";
import mqttjs, { IClientPublishOptions } from "mqtt";

const MQTT_BROKER = env.get("MQTT_BROKER").required().asString();
const MQTT_USERNAME = env.get("MQTT_USERNAME").asString();
const MQTT_PASSWORD = env.get("MQTT_PASSWORD").asString();

export default async function initializeMqttClient(
  subscribeTopics: string[],
  handleMessage: (topic: string, message: string) => Promise<void>,
) {
  const client = await mqttjs.connectAsync(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  client.on("message", (topic, payload) => {
    logger.debug(`[MQTT] receive topic: ${topic}`);
    handleMessage(topic, payload.toString()).catch((err) => {
      logger.error("[MQTT] message error:", err);
    });
  });

  logger.info("[MQTT] connected");

  await client.subscribeAsync(subscribeTopics);

  for (const topic of subscribeTopics) {
    logger.debug(`[MQTT] subscribe topic: ${topic}`);
  }

  const close = async () => {
    await client.endAsync();
    logger.info("[MQTT] closed");
  };

  const publish = async (
    topic: string,
    message: string,
    retain?: boolean,
  ): Promise<void> => {
    const options: IClientPublishOptions = {};
    if (retain) {
      options.retain = true;
    }
    await client.publishAsync(topic, message, options);
  };

  return {
    publish,
    close,
  };
}
