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
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("alive: true", async () => {
    mockProbe.mockReturnValueOnce({ alive: true });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/operation/alive");
    const { lastAlive, close } = await requestAlive(config, 100000);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(true);
  });

  test("alive: false", async () => {
    mockProbe.mockReturnValueOnce({ alive: false });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/operation/alive");
    const { lastAlive, close } = await requestAlive(config, 100000);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("throw error", async () => {
    mockProbe.mockImplementationOnce(() => {
      throw new Error();
    });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/operation/alive");
    const { lastAlive, close } = await requestAlive(config, 100000);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("listener", async () => {
    mockProbe
      .mockReturnValueOnce({ alive: true })
      .mockReturnValueOnce({ alive: false });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { requestAlive } = await import("@/operation/alive");
    const alive = await requestAlive(config, 300);
    const mockListener = jest.fn();
    alive.addListener(mockListener);
    await setTimeout(400);
    alive.close();

    expect(mockProbe).toHaveBeenCalledTimes(2);
    expect(alive.lastAlive).toBe(false);
    expect(mockListener).toHaveBeenCalledWith(false);
  });
});
