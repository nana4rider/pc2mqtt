import { Entity } from "@/entity";
import { getTopic, TopicType } from "@/payload/topic";
import env from "env-var";
import { readFile } from "fs/promises";
import type { JsonObject, PackageJson } from "type-fest";

export type Payload = JsonObject;

export const StatusMessage = {
  ON: "ON",
  OFF: "OFF",
} as const;
type StatusMessage = (typeof StatusMessage)[keyof typeof StatusMessage];

const QOS = env.get("QOS").default(1).asIntPositive();

export function buildEntity(deviceId: string, entity: Entity) {
  return {
    unique_id: `pc2mqtt_${deviceId}_${entity.id}`,
    name: entity.name,
    command_topic: getTopic(entity, TopicType.COMMAND),
    state_topic: getTopic(entity, TopicType.STATE),
    availability_topic: getTopic(entity, TopicType.AVAILABILITY),
    optimistic: true,
    qos: QOS,
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

export async function buildOrigin(): Promise<Readonly<Payload>> {
  const { homepage, name, version } = JSON.parse(
    await readFile("package.json", "utf-8"),
  ) as PackageJson;
  const origin: Payload = {};
  if (typeof name === "string") origin.name = name;
  if (typeof version === "string") origin.sw_version = version;
  if (typeof homepage === "string") origin.support_url = homepage;
  return { origin };
}
