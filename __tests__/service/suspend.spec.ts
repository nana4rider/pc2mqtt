import { RemoteConfig } from "@/entity";
import { suspend } from "@/service/suspend";
import path from "path";

const mockConnect = jest.fn();
const mockExecCommand = jest.fn();

jest.mock("node-ssh", () => ({
  NodeSSH: function () {
    return {
      connect: mockConnect,
      execCommand: mockExecCommand,
      dispose: () => {},
    };
  },
}));

describe("getSuspendCommand", () => {
  const env = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...env };
  });

  test("Windows id_rsa", async () => {
    const homePath = "path/to/home";
    delete process.env.HOME;
    process.env.HOMEPATH = homePath;

    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKeyPath: path.join(homePath, ".ssh", "id_rsa"),
      }),
    );
  });

  test("Linux id_rsa", async () => {
    const homePath = "path/to/home";
    process.env.HOME = homePath;
    delete process.env.HOMEPATH;

    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKeyPath: path.join(homePath, ".ssh", "id_rsa"),
      }),
    );
  });

  test("パスワードが設定されている時はprivateKeyPathを補完しない", async () => {
    process.env.HOME = "path/to/home";

    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {
        password: "password",
      },
    } as RemoteConfig);

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKeyPath: undefined,
      }),
    );
  });

  test("Linux OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "Linux" });

    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenCalledWith("sudo systemctl suspend");
  });

  test("Mac OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "Darwin" });

    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenCalledWith("sudo pmset sleepnow");
  });

  test("Windows OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "" });

    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenCalledWith(
      "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
    );
  });

  test("接続に失敗してもエラーにしない", async () => {
    mockExecCommand.mockReturnValue(Promise.reject(new Error()));
    mockExecCommand.mockReturnValueOnce({ stdout: "" });

    const actual = suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    await expect(actual).resolves.not.toThrow();
  });

  test("コマンド実行に失敗してもエラーにしない", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "" });
    mockExecCommand.mockReturnValue(Promise.reject(new Error()));

    const actual = suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    await expect(actual).resolves.not.toThrow();
  });
});
