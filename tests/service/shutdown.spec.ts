import type { RemoteConfig } from "@/entity";
import shutdown from "@/service/shutdown";
import path from "path";

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
  const env = process.env;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env };
  });

  test("Windows id_ed25519", async () => {
    const homePath = "path/to/home";
    delete process.env.HOME;
    process.env.HOMEPATH = homePath;

    await shutdown({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockConnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        privateKeyPath: path.join(homePath, ".ssh", "id_ed25519"),
      }),
    );
  });

  test("Linux id_ed25519", async () => {
    const homePath = "path/to/home";
    process.env.HOME = homePath;
    delete process.env.HOMEPATH;

    await shutdown({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockConnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        privateKeyPath: path.join(homePath, ".ssh", "id_ed25519"),
      }),
    );
  });

  test("パスワードが設定されている時はprivateKeyPathを補完しない", async () => {
    process.env.HOME = "path/to/home";

    await shutdown({
      ipAddress: "192.168.1.1",
      ssh: {
        password: "password",
      },
    } as RemoteConfig);

    expect(mockConnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        privateKeyPath: undefined,
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
