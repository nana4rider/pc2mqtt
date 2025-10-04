import type { Entity } from "@/entity";
import env from "@/env";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import type * as builder from "@/payload/builder";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import type { Alive } from "@/service/alive";
import initializeMqttClient from "@/service/mqtt";
import shutdown from "@/service/shutdown";
import startup from "@/service/startup";

vi.mock("@/payload/builder", async () => {
  const actual = await vi.importActual<typeof builder>("@/payload/builder");
  return {
    ...actual,
    buildDevice: vi.fn(),
    buildEntity: vi.fn(),
    buildOrigin: vi.fn(),
  };
});

vi.mock("@/service/startup", () => ({
  default: vi.fn(),
}));

vi.mock("@/service/shutdown", () => ({
  default: vi.fn(),
}));

vi.mock("@/service/mqtt", () => ({
  default: vi.fn(),
}));

const mockPublish = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(initializeMqttClient).mockResolvedValue({
    publish: mockPublish,
    taskQueueSize: 0,
    close: vi.fn(),
  });
});

function getMockAlive(lastAlive: boolean): Alive {
  return {
    lastAlive,
    addListener: vi.fn(),
    close: vi.fn(),
  };
}

describe("setupMqttDeviceManager", () => {
  test("エンティティごとのトピックが正しく購読される", async () => {
    const entities = [{ id: "entity1" }, { id: "entity2" }] as Entity[];

    const alives = new Map<string, Alive>([
      ["entity1", getMockAlive(false)],
      ["entity2", getMockAlive(true)],
    ]);

    vi.mocked(buildOrigin).mockReturnValue({ origin: "test-origin" });
    vi.mocked(buildDevice).mockReturnValue({ device: "test-device" });
    vi.mocked(buildEntity).mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    expect(initializeMqttClient).toHaveBeenCalledExactlyOnceWith(
      ["pc2mqtt/device-id/entity1/set", "pc2mqtt/device-id/entity2/set"],
      expect.any(Function),
    );
  });

  test("受信したメッセージでONになる", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([["entity1", getMockAlive(false)]]);

    vi.mocked(buildOrigin).mockReturnValue({ origin: "test-origin" });
    vi.mocked(buildDevice).mockReturnValue({ device: "test-device" });
    vi.mocked(buildEntity).mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage("pc2mqtt/device-id/entity1/set", StatusMessage.ON);

    expect(startup).toHaveBeenCalled();
  });

  test("受信したメッセージでOFFになる", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([["entity1", getMockAlive(true)]]);

    vi.mocked(buildOrigin).mockReturnValue({ origin: "test-origin" });
    vi.mocked(buildDevice).mockReturnValue({ device: "test-device" });
    vi.mocked(buildEntity).mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage("pc2mqtt/device-id/entity1/set", StatusMessage.OFF);

    expect(shutdown).toHaveBeenCalled();
  });

  test("未登録のトピックにメッセージが来た場合、無視する", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([["entity1", getMockAlive(false)]]);

    await setupMqttDeviceManager("device-id", entities, alives);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage(
      "pc2mqtt/device-id/unknown-entity/set",
      StatusMessage.ON,
    );

    expect(startup).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
  });

  test("Home Assistantにデバイス情報が送信される", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([["entity1", getMockAlive(false)]]);

    vi.mocked(buildOrigin).mockReturnValue({ origin: "test-origin" });
    vi.mocked(buildDevice).mockReturnValue({ device: "test-device" });
    vi.mocked(buildEntity).mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    expect(mockPublish).toHaveBeenLastCalledWith(
      `${env.HA_DISCOVERY_PREFIX}/switch/unique-id/config`,
      JSON.stringify({
        unique_id: "unique-id",
        device: "test-device",
        origin: "test-origin",
      }),
      { qos: 1, retain: true },
    );
  });

  test("状態の変更イベントが正しく処理される", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const mockAlive = getMockAlive(false);
    const alives = new Map<string, Alive>([["entity1", mockAlive]]);

    await setupMqttDeviceManager("device-id", entities, alives);

    expect(mockAlive.addListener).toHaveBeenCalled();
  });

  test("状態の変更を検知すると通知する", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const mockAlive = getMockAlive(false);
    const alives = new Map<string, Alive>([["entity1", mockAlive]]);

    await setupMqttDeviceManager("device-id", entities, alives);
    const mockListener = vi.mocked(mockAlive.addListener).mock.calls[0][0];
    mockListener(true);

    expect(mockPublish).toHaveBeenLastCalledWith(
      "pc2mqtt/device-id/entity1/state",
      "ON",
      { retain: false },
    );
  });

  test("電源の状態を変更して暫くの間、状態の変更を通知しない", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const mockAlive = getMockAlive(false);
    const alives = new Map<string, Alive>([["entity1", mockAlive]]);

    await setupMqttDeviceManager("device-id", entities, alives);

    // 電源ON
    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage("pc2mqtt/device-id/entity1/set", StatusMessage.ON);

    mockPublish.mockReset();
    // 直後のリスナー
    const mockListener = vi.mocked(mockAlive.addListener).mock.calls[0][0];
    mockListener(false);

    expect(mockPublish).not.toHaveBeenCalled();
  });
});
