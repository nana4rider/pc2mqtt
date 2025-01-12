import { RemoteConfig } from "@/entity";
import { requestAlive } from "@/service/alive";
import ping from "ping";
import { setTimeout } from "timers/promises";

jest.mock("ping", () => ({
  promise: {
    probe: jest.fn(),
  },
}));

describe("requestAlive", () => {
  const env = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...env };
  });

  test("alive: true", async () => {
    // eslint-disable-next-line jest/unbound-method
    const mockProbe = ping.promise.probe as jest.Mock;
    mockProbe.mockResolvedValueOnce({ alive: true });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(true);
  });

  test("alive: false", async () => {
    // eslint-disable-next-line jest/unbound-method
    const mockProbe = ping.promise.probe as jest.Mock;
    mockProbe.mockResolvedValueOnce({ alive: false });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("throw error", async () => {
    // eslint-disable-next-line jest/unbound-method
    const mockProbe = ping.promise.probe as jest.Mock;
    mockProbe.mockRejectedValueOnce(new Error());

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("listener", async () => {
    // eslint-disable-next-line jest/unbound-method
    const mockProbe = ping.promise.probe as jest.Mock;
    mockProbe
      .mockResolvedValueOnce({ alive: true })
      .mockResolvedValueOnce({ alive: false });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const alive = await requestAlive(config);
    const mockListener = jest.fn();
    alive.addListener(mockListener);
    await setTimeout(300);
    alive.close();

    expect(mockProbe).toHaveBeenCalledTimes(2);
    expect(alive.lastAlive).toBe(false);
    expect(mockListener).toHaveBeenCalledWith(false);
  });
});
