import { Entity } from "@/entity";

export const TopicType = {
  COMMAND: "set",
  STATE: "state",
  AVAILABILITY: "availability",
} as const;
type TopicType = (typeof TopicType)[keyof typeof TopicType];

export function getTopic(
  deviceId: string,
  entity: Entity,
  type: TopicType,
): string {
  return `pc2mqtt/${deviceId}/${entity.id}/${type}`;
}
