import { Entity } from "@/entity";
import { getTopic, TopicType } from "@/payload/topic";
import { MqttClient } from "@/service/mqtt";
import env from "env-var";

const AVAILABILITY_INTERVAL = env
  .get("AVAILABILITY_INTERVAL")
  .default(10000)
  .asIntPositive();

export function setupAvailability(entities: Entity[], mqtt: MqttClient) {
  const pushAvailability = (value: string) => {
    entities.forEach((entity) =>
      mqtt.publish(getTopic(entity, TopicType.AVAILABILITY), value),
    );
  };

  const pushOnline = () => pushAvailability("online");

  // オンライン状態を定期的に送信
  const availabilityTimerId = setInterval(pushOnline, AVAILABILITY_INTERVAL);

  const close = () => {
    clearInterval(availabilityTimerId);
    pushAvailability("offline");
  };

  return {
    pushOnline,
    close,
  };
}
