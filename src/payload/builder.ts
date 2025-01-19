import { Entity } from "@/entity";
import env from "@/env";
import { getTopic, TopicType } from "@/payload/topic";
import type { JsonObject } from "type-fest";
import {
  homepage as packageHomepage,
  name as packageName,
  version as packageVersion,
} from "~/package.json";

export type Payload = JsonObject;

export const StatusMessage = {
  ON: "ON",
  OFF: "OFF",
} as const;
type StatusMessage = (typeof StatusMessage)[keyof typeof StatusMessage];

export function buildEntity(
  deviceId: string,
  entity: Entity,
): Readonly<Payload & { unique_id: string }> {
  return {
    unique_id: `pc2mqtt_${deviceId}_${entity.id}`,
    name: entity.name,
    command_topic: getTopic(deviceId, entity, TopicType.COMMAND),
    state_topic: getTopic(deviceId, entity, TopicType.STATE),
    availability_topic: getTopic(deviceId, entity, TopicType.AVAILABILITY),
    optimistic: true,
    qos: env.ENTITY_QOS,
  } as const;
}

export function buildDevice(deviceId: string): Readonly<Payload> {
  return {
    device: {
      identifiers: [`pc2mqtt_${deviceId}`],
      name: `pc2mqtt.${deviceId}`,
      model: "pc2mqtt",
      manufacturer: "nana4rider",
    },
  };
}

export function buildOrigin(): Readonly<Payload> {
  const origin: Payload = {};
  if (typeof packageName === "string") origin.name = packageName;
  if (typeof packageVersion === "string") origin.sw_version = packageVersion;
  if (typeof packageHomepage === "string") origin.support_url = packageHomepage;
  return { origin };
}
