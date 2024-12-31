import { RemoteConfig } from "@/index";
import ip from "ip";
import wol from "wol";

function getDefaultSubnetMask(ipAddress: string) {
  if (!ip.isV4Format(ipAddress)) {
    throw new Error(`'${ipAddress}' is not in IPv4 format.`);
  }

  const [firstOctet] = ip.toBuffer(ipAddress);

  let prefixLength: number;
  if (firstOctet >= 0 && firstOctet <= 127) {
    prefixLength = 8; // Class A
  } else if (firstOctet >= 128 && firstOctet <= 191) {
    prefixLength = 16; // Class B
  } else if (firstOctet >= 192 && firstOctet <= 223) {
    prefixLength = 24; // Class C
  } else {
    throw new Error(`'${ipAddress}' does not belong to Class A, B, or C.`);
  }

  return ip.fromPrefixLen(prefixLength);
}

export async function startup(config: RemoteConfig) {
  const subnetMask =
    config.subnetMask ?? getDefaultSubnetMask(config.ipAddress);
  const address = ip.subnet(config.ipAddress, subnetMask).broadcastAddress;
  await wol.wake(config.macAddress, { address });
}
