import type { RemoteConfig } from "@/entity";
import requestAlive from "@/service/alive";
import type { PingResponse } from "ping";
import ping from "ping";
import { setTimeout } from "timers/promises";

vi.mock("ping", () => ({
  default: {
    promise: {
      probe: vi.fn(),
    },
  },
}));

describe("requestAlive", () => {
  const mockProbe = vi.mocked(ping.promise.probe);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("alive: true", async () => {
    mockProbe.mockResolvedValueOnce({ alive: true } as PingResponse);

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(true);
  });

  test("alive: false", async () => {
    mockProbe.mockResolvedValueOnce({ alive: false } as PingResponse);

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("throw error", async () => {
    mockProbe.mockRejectedValueOnce(new Error());

    const config = { ipAddress: "192.168.1.1" } as RemoteConfig;

    const { lastAlive, close } = await requestAlive(config);
    close();

    expect(mockProbe).toHaveBeenCalledWith("192.168.1.1", { timeout: 1 });
    expect(lastAlive).toBe(false);
  });

  test("listener", async () => {
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
