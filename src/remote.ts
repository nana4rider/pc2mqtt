export type RemoteConfig = {
  ssh: {
    username: string;
    privateKeyPath: string;
    port?: number;
  };
  macAddress: string;
  ipAddress: string;
};

// TODO
export function remoteCommand(config: RemoteConfig) {
  return {
    startup: async () => {
      // WoL
    },

    shutdown: async () => {
      // SSH
    },

    isRunning: async () => {
      // Ping
      return config.ipAddress !== "";
    },
  };
}
