import { Config as SSHConfig } from "node-ssh";

export type Entity = {
  id: string;
  name: string;
  remote: RemoteConfig;
};

export type RemoteConfig = {
  ssh: SSHConfig;
  macAddress: string;
  ipAddress: string;
  subnetMask?: string;
};
