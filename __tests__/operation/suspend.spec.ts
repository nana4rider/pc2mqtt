import { RemoteConfig } from "@/entity";
import { jest } from "@jest/globals";

const mockConnect = jest.fn();
const mockExecCommand = jest.fn();

jest.unstable_mockModule("node-ssh", () => {
  return {
    NodeSSH: function () {
      return {
        connect: mockConnect,
        execCommand: mockExecCommand,
        dispose: () => {},
      };
    },
  };
});

describe("getSuspendCommand", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("Linux OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "Linux" });

    const { suspend } = await import("@/operation/suspend");
    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenCalledWith("sudo systemctl suspend");
  });

  test("Mac OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "Darwin" });

    const { suspend } = await import("@/operation/suspend");
    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenCalledWith("sudo pmset sleepnow");
  });

  test("Windows OS", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "" });

    const { suspend } = await import("@/operation/suspend");
    await suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    expect(mockExecCommand).toHaveBeenCalledWith(
      "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
    );
  });

  test("接続に失敗してもエラーにしない", async () => {
    mockConnect.mockImplementationOnce(() => {
      throw new Error();
    });
    mockExecCommand.mockReturnValueOnce({ stdout: "" });

    const { suspend } = await import("@/operation/suspend");
    const actual = suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    await expect(actual).resolves.not.toThrow();
  });

  test("コマンド実行に失敗してもエラーにしない", async () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "" });
    mockExecCommand.mockImplementationOnce(() => {
      throw new Error();
    });

    const { suspend } = await import("@/operation/suspend");
    const actual = suspend({
      ipAddress: "192.168.1.1",
      ssh: {},
    } as RemoteConfig);

    await expect(actual).resolves.not.toThrow();
  });
});
