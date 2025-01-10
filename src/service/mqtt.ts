import logger from "@/logger";
import env from "env-var";
import mqttjs, { IClientPublishOptions } from "mqtt";
import { setTimeout } from "timers/promises";

const MQTT_BROKER = env.get("MQTT_BROKER").required().asString();
const MQTT_USERNAME = env.get("MQTT_USERNAME").asString();
const MQTT_PASSWORD = env.get("MQTT_PASSWORD").asString();
const MQTT_TASK_INTERVAL = env
  .get("MQTT_TASK_INTERVAL")
  .default(100)
  .asIntPositive();

export default async function initializeMqttClient(
  subscribeTopics: string[],
  handleMessage: (topic: string, message: string) => Promise<void>,
) {
  const client = await mqttjs.connectAsync(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });
  const taskQueue: (() => Promise<void>)[] = [];

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

  let isMqttTaskRunning = true;
  const mqttTask = (async () => {
    while (isMqttTaskRunning) {
      logger.silly(`[MQTT] taskQueue: ${taskQueue.length}`);
      const task = taskQueue.shift();
      if (task) {
        await task();
      }
      await setTimeout(MQTT_TASK_INTERVAL);
    }
  })();

  const close = async (wait: boolean = false): Promise<void> => {
    isMqttTaskRunning = false;

    if (wait) {
      logger.info("[MQTT] waiting for taskQueue to empty...");
      while (taskQueue.length > 0) {
        await setTimeout(MQTT_TASK_INTERVAL);
      }
      logger.info("[MQTT] taskQueue is empty");
    }

    await mqttTask;
    logger.info("[MQTT] task stopped");
    await client.endAsync();
    logger.info("[MQTT] closed");
  };

  const publish = (topic: string, message: string, retain?: boolean): void => {
    const options: IClientPublishOptions = {};
    if (retain) {
      options.retain = true;
    }
    taskQueue.push(async () => {
      await client.publishAsync(topic, message, options);
    });
  };

  const addSubscribe = (topic: string): void => {
    taskQueue.push(async () => {
      await client.subscribeAsync(topic);
    });
  };

  return {
    get taskQueueSize() {
      return taskQueue.length;
    },
    publish,
    addSubscribe,
    close,
  };
}
