import type { RemoteConfig } from "@/entity";
import { Address4 } from "ip-address";
import wol from "wol";

function getDefaultSubnetMask(ipAddress: string) {
  if (!Address4.isValid(ipAddress)) {
    throw new Error(`'${ipAddress}' is not in IPv4 format.`);
  }

  const [firstOctet] = new Address4(ipAddress).toArray();

  let prefixLength: number;
  if (firstOctet <= 127) {
    prefixLength = 8; // Class A
  } else if (firstOctet <= 191) {
    prefixLength = 16; // Class B
  } else if (firstOctet <= 223) {
    prefixLength = 24; // Class C
  } else {
    throw new Error(`'${ipAddress}' does not belong to Class A, B, or C.`);
  }

  return new Address4(`0.0.0.0/${prefixLength}`)
    .subnetMaskAddress()
    .correctForm();
}

export default async function startup(config: RemoteConfig) {
  const subnetMask =
    config.subnetMask ?? getDefaultSubnetMask(config.ipAddress);
  const address = Address4.fromAddressAndMask(config.ipAddress, subnetMask)
    .endAddress()
    .correctForm();
  await wol.wake(config.macAddress, { address });
}
