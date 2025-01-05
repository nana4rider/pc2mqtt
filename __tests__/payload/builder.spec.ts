import { Entity } from "@/entity";
import { buildDevice, buildEntity, buildOrigin } from "@/payload/builder";
import { TopicType } from "@/payload/topic";

describe("buildEntity", () => {
  test("必要な属性が揃っている", () => {
    const mockEntity = {
      id: "entity1",
      name: "Test Entity",
    } as Entity;

    const entity = buildEntity("deviceId1", mockEntity);

    expect(entity).toHaveProperty("unique_id", "pc2mqtt_deviceId1_entity1");
    expect(entity).toHaveProperty("name", "Test Entity");
    expect(entity).toHaveProperty(
      "command_topic",
      `pc2mqtt/entity1/${TopicType.COMMAND}`,
    );
    expect(entity).toHaveProperty(
      "state_topic",
      `pc2mqtt/entity1/${TopicType.STATE}`,
    );
    expect(entity).toHaveProperty(
      "availability_topic",
      `pc2mqtt/entity1/${TopicType.AVAILABILITY}`,
    );
    expect(entity).toHaveProperty("optimistic", true);
  });
});

describe("device", () => {
  test("必要な属性が揃っている", () => {
    const device = buildDevice("deviceId1");
    expect(device).toHaveProperty("device.identifiers");
    expect(device).toHaveProperty("device.name");
    expect(device).toHaveProperty("device.model");
    expect(device).toHaveProperty("device.manufacturer");
  });
});

describe("origin", () => {
  test("必要な属性が揃っている", async () => {
    const origin = await buildOrigin();
    expect(origin).toHaveProperty("origin.name");
    expect(origin).toHaveProperty("origin.sw_version");
    expect(origin).toHaveProperty("origin.support_url");
  });
});
