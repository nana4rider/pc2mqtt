import { RemoteConfig } from "@/entity";
import startup from "@/service/startup";
import wol from "wol";

jest.mock("wol", () => ({
  wake: jest.fn(),
}));

describe("startup", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  test("指定されたサブネットマスクを使用して wol.wake を呼び出す", async () => {
    await startup({
      ipAddress: "192.168.1.10",
      macAddress: "00:11:22:33:44:55",
      subnetMask: "255.255.255.0",
    } as RemoteConfig);

    expect(wol.wake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "192.168.1.255",
    });
  });

  test("クラス A アドレスでデフォルトのサブネットマスクを計算する", async () => {
    await startup({
      ipAddress: "10.0.0.1",
      macAddress: "00:11:22:33:44:55",
    } as RemoteConfig);

    expect(wol.wake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "10.255.255.255",
    });
  });

  test("クラス B アドレスでデフォルトのサブネットマスクを計算する", async () => {
    await startup({
      ipAddress: "172.16.0.1",
      macAddress: "00:11:22:33:44:55",
    } as RemoteConfig);

    expect(wol.wake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "172.16.255.255",
    });
  });

  test("クラス C アドレスでデフォルトのサブネットマスクを計算する", async () => {
    await startup({
      ipAddress: "192.168.1.1",
      macAddress: "00:11:22:33:44:55",
    } as RemoteConfig);

    expect(wol.wake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "192.168.1.255",
    });
  });

  test("IP アドレスが IPv4 形式でない場合、エラーをスローする", async () => {
    await expect(
      startup({
        ipAddress: "invalid-ip",
        macAddress: "00:11:22:33:44:55",
      } as RemoteConfig),
    ).rejects.toThrow("'invalid-ip' is not in IPv4 format.");

    expect(wol.wake).not.toHaveBeenCalled();
  });

  test("IP アドレスがクラス A, B, C でない場合、エラーをスローする", async () => {
    await expect(
      startup({
        ipAddress: "240.0.0.1",
        macAddress: "00:11:22:33:44:55",
      } as RemoteConfig),
    ).rejects.toThrow("'240.0.0.1' does not belong to Class A, B, or C.");

    expect(wol.wake).not.toHaveBeenCalled();
  });
});
