import { RemoteConfig } from "@/entity";
import { jest } from "@jest/globals";

const mockIsV4Format = jest.fn();
const mockToBuffer = jest.fn();
const mockFromPrefixLen = jest.fn();
const mockSubnet = jest.fn();
const mockWake = jest.fn();

jest.unstable_mockModule("ip", () => {
  return {
    default: {
      isV4Format: mockIsV4Format,
      toBuffer: mockToBuffer,
      fromPrefixLen: mockFromPrefixLen,
      subnet: mockSubnet,
    },
  };
});

jest.unstable_mockModule("wol", () => {
  return {
    default: {
      wake: mockWake,
    },
  };
});

describe("startup", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("指定されたサブネットマスクを使用して wol.wake を呼び出す", async () => {
    mockSubnet.mockReturnValue({ broadcastAddress: "192.168.1.255" });

    const { startup } = await import("@/operation/startup");
    await startup({
      ipAddress: "192.168.1.10",
      macAddress: "00:11:22:33:44:55",
      subnetMask: "255.255.255.0",
    } as RemoteConfig);

    expect(mockSubnet).toHaveBeenCalledWith("192.168.1.10", "255.255.255.0");
    expect(mockWake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "192.168.1.255",
    });
  });

  test("クラス A アドレスでデフォルトのサブネットマスクを計算する", async () => {
    mockIsV4Format.mockReturnValue(true);
    mockToBuffer.mockReturnValue(Buffer.from([10]));
    mockFromPrefixLen.mockReturnValue("255.0.0.0");
    mockSubnet.mockReturnValue({ broadcastAddress: "10.255.255.255" });

    const { startup } = await import("@/operation/startup");
    await startup({
      ipAddress: "10.0.0.1",
      macAddress: "00:11:22:33:44:55",
    } as RemoteConfig);

    expect(mockIsV4Format).toHaveBeenCalledWith("10.0.0.1");
    expect(mockToBuffer).toHaveBeenCalledWith("10.0.0.1");
    expect(mockFromPrefixLen).toHaveBeenCalledWith(8); // Class A
    expect(mockSubnet).toHaveBeenCalledWith("10.0.0.1", "255.0.0.0");
    expect(mockWake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "10.255.255.255",
    });
  });

  test("クラス B アドレスでデフォルトのサブネットマスクを計算する", async () => {
    mockIsV4Format.mockReturnValue(true);
    mockToBuffer.mockReturnValue(Buffer.from([172]));
    mockFromPrefixLen.mockReturnValue("255.255.0.0");
    mockSubnet.mockReturnValue({ broadcastAddress: "172.16.255.255" });

    const { startup } = await import("@/operation/startup");
    await startup({
      ipAddress: "172.16.0.1",
      macAddress: "00:11:22:33:44:55",
    } as RemoteConfig);

    expect(mockIsV4Format).toHaveBeenCalledWith("172.16.0.1");
    expect(mockToBuffer).toHaveBeenCalledWith("172.16.0.1");
    expect(mockFromPrefixLen).toHaveBeenCalledWith(16); // Class B
    expect(mockSubnet).toHaveBeenCalledWith("172.16.0.1", "255.255.0.0");
    expect(mockWake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "172.16.255.255",
    });
  });

  test("クラス C アドレスでデフォルトのサブネットマスクを計算する", async () => {
    mockIsV4Format.mockReturnValue(true);
    mockToBuffer.mockReturnValue(Buffer.from([192]));
    mockFromPrefixLen.mockReturnValue("255.255.255.0");
    mockSubnet.mockReturnValue({ broadcastAddress: "192.168.1.255" });

    const { startup } = await import("@/operation/startup");
    await startup({
      ipAddress: "192.168.1.1",
      macAddress: "00:11:22:33:44:55",
    } as RemoteConfig);

    expect(mockIsV4Format).toHaveBeenCalledWith("192.168.1.1");
    expect(mockToBuffer).toHaveBeenCalledWith("192.168.1.1");
    expect(mockFromPrefixLen).toHaveBeenCalledWith(24); // Class C
    expect(mockSubnet).toHaveBeenCalledWith("192.168.1.1", "255.255.255.0");
    expect(mockWake).toHaveBeenCalledWith("00:11:22:33:44:55", {
      address: "192.168.1.255",
    });
  });

  test("IP アドレスが IPv4 形式でない場合、エラーをスローする", async () => {
    mockIsV4Format.mockReturnValue(false);

    const { startup } = await import("@/operation/startup");

    await expect(
      startup({
        ipAddress: "invalid-ip",
        macAddress: "00:11:22:33:44:55",
      } as RemoteConfig),
    ).rejects.toThrow("'invalid-ip' is not in IPv4 format.");

    expect(mockIsV4Format).toHaveBeenCalledWith("invalid-ip");
    expect(mockWake).not.toHaveBeenCalled();
  });

  test("IP アドレスがクラス A, B, C でない場合、エラーをスローする", async () => {
    mockIsV4Format.mockReturnValue(true);
    mockToBuffer.mockReturnValue(Buffer.from([240]));

    const { startup } = await import("@/operation/startup");

    await expect(
      startup({
        ipAddress: "240.0.0.1",
        macAddress: "00:11:22:33:44:55",
      } as RemoteConfig),
    ).rejects.toThrow("'240.0.0.1' does not belong to Class A, B, or C.");

    expect(mockIsV4Format).toHaveBeenCalledWith("240.0.0.1");
    expect(mockToBuffer).toHaveBeenCalledWith("240.0.0.1");
    expect(mockWake).not.toHaveBeenCalled();
  });
});
