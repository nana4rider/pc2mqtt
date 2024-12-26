import { NodeSSH, Config as SSHConfig } from "node-ssh";
import wol from "wol";
import ping from "ping";
import path from "path";
import ip from "ip";

export type RemoteConfig = {
  ssh: SSHConfig;
  macAddress: string;
  ipAddress: string;
  subnetMask?: string;
};

enum SuspendCommand {
  WINDOWS = "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
  LINUX = "sudo systemctl suspend",
  MAC = "sudo pmset sleepnow",
}

const ssh = new NodeSSH();

async function getSuspendCommand(): Promise<SuspendCommand> {
  const { stdout: uname } = await ssh.execCommand("uname");

  if (uname === "Linux") {
    return SuspendCommand.LINUX;
  } else if (uname === "Darwin") {
    return SuspendCommand.MAC;
  } else {
    return SuspendCommand.WINDOWS;
  }
}

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

export function remoteCommand(config: RemoteConfig) {
  return {
    startup: async () => {
      const subnetMask =
        config.subnetMask ?? getDefaultSubnetMask(config.ipAddress);
      const address = ip.subnet(config.ipAddress, subnetMask).broadcastAddress;
      await wol.wake(config.macAddress, { address });
    },

    suspend: async (): Promise<void> => {
      const homeDir = process.env.HOME ?? process.env.HOMEPATH;
      const host = config.ipAddress;
      const privateKeyPath =
        homeDir && !config.ssh.password
          ? path.join(homeDir, ".ssh", "id_rsa")
          : undefined;

      try {
        await ssh.connect({ host, privateKeyPath, ...config.ssh });
        const suspendCommand = await getSuspendCommand();
        await ssh.execCommand(suspendCommand);
      } catch (err) {
        console.log(ssh, err);
      }
    },

    isRunning: async (): Promise<boolean> => {
      try {
        const { alive } = await ping.promise.probe(config.ipAddress);
        return alive;
      } catch (err) {
        console.log("ping", err);
        return false;
      }
    },
  };
}
