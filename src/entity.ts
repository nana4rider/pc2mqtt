import type { Config as SSHConfig } from "node-ssh";

export type Entity = {
  id: string;
  name: string;
  remote: RemoteConfig;
};

export type RemoteConfig = {
  ssh: Pick<
    SSHConfig,
    "username" | "password" | "privateKey" | "privateKeyPath" | "port"
  >;
  macAddress: string;
  ipAddress: string;
  subnetMask?: string;
};
