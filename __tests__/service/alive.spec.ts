import { RemoteConfig } from "@/entity";
import { jest } from "@jest/globals";
import { setTimeout } from "timers/promises";

const mockProbe = jest.fn();

jest.unstable_mockModule("ping", () => {
  return {
    default: {
      promise: {
        probe: mockProbe,
      },
    },
  };
});

describe("requestAlive", () => {
  const env = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...env };
  });

  test("alive: true", async () => {
    mockProbe.mockReturnValueOnce(Promise.resolve({ alive: true }));

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/service/alive");
    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(true);
  });

  test("alive: false", async () => {
    mockProbe.mockReturnValueOnce(Promise.resolve({ alive: false }));

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/service/alive");
    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("throw error", async () => {
    mockProbe.mockReturnValue(Promise.reject(new Error()));

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/service/alive");
    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("listener", async () => {
    process.env.CHECK_ALIVE_INTERVAL = "300";

    mockProbe
      .mockReturnValueOnce({ alive: true })
      .mockReturnValueOnce({ alive: false });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/service/alive");
    const alive = await requestAlive(config);
    const mockListener = jest.fn();
    alive.addListener(mockListener);
    await setTimeout(400);
    alive.close();

    expect(mockProbe).toHaveBeenCalledTimes(2);
    expect(alive.lastAlive).toBe(false);
    expect(mockListener).toHaveBeenCalledWith(false);
  });
});
