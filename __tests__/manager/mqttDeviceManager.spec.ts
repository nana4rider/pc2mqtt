import { Entity } from "@/entity";
import env from "@/env";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import * as builder from "@/payload/builder";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { Alive } from "@/service/alive";
import initializeMqttClient from "@/service/mqtt";
import startup from "@/service/startup";
import suspend from "@/service/suspend";

jest.mock("@/payload/builder", () => {
  const actual = jest.requireActual<typeof builder>("@/payload/builder");
  return {
    ...actual,
    buildDevice: jest.fn(),
    buildEntity: jest.fn(),
    buildOrigin: jest.fn(),
  };
});

jest.mock("@/service/startup", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/service/suspend", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/service/mqtt", () => jest.fn());

const mockBuildOrigin = buildOrigin as jest.Mock<
  ReturnType<typeof buildOrigin>,
  Parameters<typeof buildOrigin>
>;
const mockBuildDevice = buildDevice as jest.Mock<
  ReturnType<typeof buildDevice>,
  Parameters<typeof buildDevice>
>;
const mockBuildEntity = buildEntity as jest.Mock<
  ReturnType<typeof buildEntity>,
  Parameters<typeof buildEntity>
>;

const mockPublish = jest.fn();
const mockInitializeMqttClient = initializeMqttClient as jest.Mock<
  ReturnType<typeof initializeMqttClient>,
  Parameters<typeof initializeMqttClient>
>;

beforeEach(() => {
  jest.resetAllMocks();

  mockInitializeMqttClient.mockResolvedValue({
    publish: mockPublish,
  } as unknown as ReturnType<typeof initializeMqttClient>);
});

describe("setupMqttDeviceManager", () => {
  test("エンティティごとのトピックが正しく購読される", async () => {
    const entities = [{ id: "entity1" }, { id: "entity2" }] as Entity[];

    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: false, addListener: jest.fn(), close: jest.fn() },
      ],
      [
        "entity2",
        { lastAlive: true, addListener: jest.fn(), close: jest.fn() },
      ],
    ]);

    mockBuildOrigin.mockReturnValue({ origin: "test-origin" });
    mockBuildDevice.mockReturnValue({ device: "test-device" });
    mockBuildEntity.mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    expect(mockInitializeMqttClient).toHaveBeenCalledWith(
      ["pc2mqtt/device-id/entity1/set", "pc2mqtt/device-id/entity2/set"],
      expect.any(Function),
    );
  });

  test("受信したメッセージでONになる", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: false, addListener: jest.fn(), close: jest.fn() },
      ],
    ]);

    mockBuildOrigin.mockReturnValue({ origin: "test-origin" });
    mockBuildDevice.mockReturnValue({ device: "test-device" });
    mockBuildEntity.mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    const handleMessage = mockInitializeMqttClient.mock.calls[0][1];
    await handleMessage("pc2mqtt/device-id/entity1/set", StatusMessage.ON);

    expect(startup).toHaveBeenCalled();
  });

  test("受信したメッセージでOFFになる", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: true, addListener: jest.fn(), close: jest.fn() },
      ],
    ]);

    mockBuildOrigin.mockReturnValue({ origin: "test-origin" });
    mockBuildDevice.mockReturnValue({ device: "test-device" });
    mockBuildEntity.mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    const handleMessage = mockInitializeMqttClient.mock.calls[0][1];
    await handleMessage("pc2mqtt/device-id/entity1/set", StatusMessage.OFF);

    expect(suspend).toHaveBeenCalled();
  });

  test("未登録のトピックにメッセージが来た場合、無視する", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: false, addListener: jest.fn(), close: jest.fn() },
      ],
    ]);

    await setupMqttDeviceManager("device-id", entities, alives);

    const handleMessage = mockInitializeMqttClient.mock.calls[0][1];
    await handleMessage(
      "pc2mqtt/device-id/unknown-entity/set",
      StatusMessage.ON,
    );

    expect(startup).not.toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
  });

  test("Home Assistantにデバイス情報が送信される", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: false, addListener: jest.fn(), close: jest.fn() },
      ],
    ]);

    mockBuildOrigin.mockReturnValue({ origin: "test-origin" });
    mockBuildDevice.mockReturnValue({ device: "test-device" });
    mockBuildEntity.mockReturnValue({ unique_id: "unique-id" });

    await setupMqttDeviceManager("device-id", entities, alives);

    expect(mockPublish).toHaveBeenCalledWith(
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

    const mockAddListener = jest.fn();
    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: false, addListener: mockAddListener, close: jest.fn() },
      ],
    ]);

    await setupMqttDeviceManager("device-id", entities, alives);

    expect(mockAddListener).toHaveBeenCalled();
  });

  test("状態の変更を検知すると通知する", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const mockAddListener = jest.fn() as jest.Mock<
      ReturnType<Alive["addListener"]>,
      Parameters<Alive["addListener"]>
    >;
    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: false, addListener: mockAddListener, close: jest.fn() },
      ],
    ]);

    await setupMqttDeviceManager("device-id", entities, alives);
    const mockListener = mockAddListener.mock.calls[0][0];
    mockListener(true);

    expect(mockPublish).toHaveBeenCalledWith(
      "pc2mqtt/device-id/entity1/state",
      "ON",
      { retain: false },
    );
  });

  test("電源の状態を変更して暫くの間、状態の変更を通知しない", async () => {
    const entities = [{ id: "entity1" }] as Entity[];

    const mockAddListener = jest.fn() as jest.Mock<
      ReturnType<Alive["addListener"]>,
      Parameters<Alive["addListener"]>
    >;
    const alives = new Map<string, Alive>([
      [
        "entity1",
        { lastAlive: false, addListener: mockAddListener, close: jest.fn() },
      ],
    ]);

    await setupMqttDeviceManager("device-id", entities, alives);

    // 電源ON
    const handleMessage = mockInitializeMqttClient.mock.calls[0][1];
    await handleMessage("pc2mqtt/device-id/entity1/set", StatusMessage.ON);

    mockPublish.mockReset();
    // 直後のリスナー
    const mockListener = mockAddListener.mock.calls[0][0];
    mockListener(false);

    expect(mockPublish).not.toHaveBeenCalled();
  });
});
