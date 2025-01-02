import { RemoteConfig } from "@/index";
import logger from "@/logger";
import { NodeSSH } from "node-ssh";
import path from "path";

const DEFAULT_TIMEOUT = 3000;

const SuspendCommand = {
  WINDOWS: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
  LINUX: "sudo systemctl suspend",
  MAC: "sudo pmset sleepnow",
} as const;
type SuspendCommand = (typeof SuspendCommand)[keyof typeof SuspendCommand];

async function getSuspendCommand(sshClient: NodeSSH): Promise<SuspendCommand> {
  const { stdout: uname } = await sshClient.execCommand("uname");

  switch (uname) {
    case "Linux":
      return SuspendCommand.LINUX;
    case "Darwin":
      return SuspendCommand.MAC;
    default:
      return SuspendCommand.WINDOWS;
  }
}

export async function suspend(config: RemoteConfig): Promise<void> {
  const sshClient = new NodeSSH();

  const homeDir = process.env.HOME ?? process.env.HOMEPATH;
  const host = config.ipAddress;
  const privateKeyPath =
    homeDir && !config.ssh.password
      ? path.join(homeDir, ".ssh", "id_rsa")
      : undefined;

  try {
    await sshClient.connect({
      host,
      readyTimeout: DEFAULT_TIMEOUT,
      privateKeyPath,
      ...config.ssh,
    });
    const suspendCommand = await getSuspendCommand(sshClient);
    try {
      await sshClient.execCommand(suspendCommand);
    } catch (err) {
      // Timed out while waiting for handshake
      logger.silly(err);
    }
  } catch (err) {
    console.error("Error executing suspend command:", err);
  } finally {
    sshClient.dispose();
  }
}
