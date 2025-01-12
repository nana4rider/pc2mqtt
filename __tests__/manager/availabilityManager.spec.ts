import { Entity } from "@/entity";
import { setupAvailability } from "@/manager/availabilityManager";
import { MqttClient } from "@/service/mqtt";
import { jest } from "@jest/globals";

describe("setupAvailability", () => {
  let mockMqttClient: jest.Mocked<MqttClient>;
  let entities: Entity[];

  beforeEach(() => {
    mockMqttClient = {
      publish: jest.fn(),
    } as unknown as jest.Mocked<MqttClient>;

    entities = [
      { id: "entity1", name: "Entity 1" },
      { id: "entity2", name: "Entity 2" },
    ] as Entity[];
  });

  it("pushOnline を呼び出すと全てのエンティティにオンライン状態を送信する", () => {
    const { pushOnline } = setupAvailability(entities, mockMqttClient);

    pushOnline();

    expect(mockMqttClient.publish).toHaveBeenCalledTimes(entities.length);
    entities.forEach((entity) => {
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        expect.stringContaining(entity.id),
        "online",
      );
    });
  });

  it("close を呼び出すとインターバルがクリアされ、全てのエンティティにオフライン状態を送信する", () => {
    jest.useFakeTimers();
    global.clearInterval = jest.fn(); // for ESM
    const { close } = setupAvailability(entities, mockMqttClient);

    close();

    expect(clearInterval).toHaveBeenCalled();
    expect(mockMqttClient.publish).toHaveBeenCalledTimes(entities.length);
    entities.forEach((entity) => {
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        expect.stringContaining(entity.id),
        "offline",
      );
    });
  });

  it("定期的にオンライン状態を送信する", () => {
    jest.useFakeTimers();
    setupAvailability(entities, mockMqttClient);

    jest.advanceTimersByTime(10000); // Assume AVAILABILITY_INTERVAL is 10000ms

    expect(mockMqttClient.publish).toHaveBeenCalledTimes(entities.length);
    entities.forEach((entity) => {
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        expect.stringContaining(entity.id),
        "online",
      );
    });

    jest.advanceTimersByTime(10000);

    expect(mockMqttClient.publish).toHaveBeenCalledTimes(entities.length * 2);
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});
