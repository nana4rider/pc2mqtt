import { RemoteConfig } from "@/entity";
import requestAlive from "@/service/alive";
import ping, { PingResponse } from "ping";
import { setTimeout } from "timers/promises";
import { Mock } from "vitest";

vi.mock("ping", () => ({
  default: {
    promise: {
      probe: vi.fn(),
    },
  },
}));

describe("requestAlive", () => {
  const env = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...env };
  });

  test("alive: true", async () => {
    const mockProbe = ping.promise.probe as Mock;
    mockProbe.mockResolvedValueOnce({ alive: true });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(true);
  });

  test("alive: false", async () => {
    const mockProbe = ping.promise.probe as Mock;
    mockProbe.mockResolvedValueOnce({ alive: false });

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("throw error", async () => {
    const mockProbe = ping.promise.probe as Mock;
    mockProbe.mockRejectedValueOnce(new Error());

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("listener", async () => {
    const mockProbe = vi.spyOn(ping.promise, "probe");
    mockProbe
      .mockResolvedValueOnce({ alive: true } as PingResponse)
      .mockResolvedValueOnce({ alive: false } as PingResponse);

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const alive = await requestAlive(config);
    const mockListener = vi.fn();
    alive.addListener(mockListener);
    await setTimeout(300);
    alive.close();

    expect(mockProbe).toHaveBeenCalledTimes(2);
    expect(alive.lastAlive).toBe(false);
    expect(mockListener).toHaveBeenCalledWith(false);
  });
});
