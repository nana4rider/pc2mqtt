import type { RemoteConfig } from "@/entity";
import shutdown from "@/service/shutdown";

const mockConnect = vi.fn();
const mockExecCommand = vi.fn();

vi.mock("node-ssh", () => ({
  NodeSSH: function () {
    return {
      connect: mockConnect,
      execCommand: mockExecCommand,
      dispose: () => {},
    };
  },
}));

describe("getShutdownCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("SSH接続設定が正しく適用される", async () => {
    await shutdown({
      ipAddress: "192.168.1.1",
      ssh: {
        privateKeyPath: "/path/to/key",
      },
    } as RemoteConfig);

    expect(mockConnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        host: "192.168.1.1",
        readyTimeout: expect.any(Number) as number,
        privateKeyPath: "/path/to/key",
      }),
    );
  });

  test("Linux OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "Linux" });

    await shutdown({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenLastCalledWith("sudo shutdown now");
  });

  test("Mac OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "Darwin" });

    await shutdown({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenLastCalledWith("sudo pmset sleepnow");
  });

  test("Windows OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "" });

    await shutdown({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenLastCalledWith("shutdown /s /t 0");
  });

  test("接続に失敗してもエラーにしない", async () => {
    mockExecCommand.mockReturnValue(Promise.reject(new Error()));
    mockExecCommand.mockReturnValueOnce({ stdout: "" });

    const actual = shutdown({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    await expect(actual).resolves.not.toThrow();
  });

  test("コマンド実行に失敗してもエラーにしない", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "" });
    mockExecCommand.mockReturnValue(Promise.reject(new Error()));

    const actual = shutdown({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    await expect(actual).resolves.not.toThrow();
  });
});
