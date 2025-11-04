import type { RemoteConfig } from "@/entity";
import logger from "@/logger";
import { NodeSSH } from "node-ssh";

const DEFAULT_TIMEOUT = 3000;

const ShutdownCommand = {
  WINDOWS: "shutdown /s /t 0",
  LINUX: "sudo shutdown now",
  MAC: "sudo pmset sleepnow",
} as const;
type ShutdownCommand = (typeof ShutdownCommand)[keyof typeof ShutdownCommand];

async function getShutdownCommand(
  sshClient: NodeSSH,
): Promise<ShutdownCommand> {
  const { stdout: uname } = await sshClient.execCommand("uname");

  switch (uname) {
    case "Linux":
      return ShutdownCommand.LINUX;
    case "Darwin":
      return ShutdownCommand.MAC;
    default:
      return ShutdownCommand.WINDOWS;
  }
}

export default async function shutdown(config: RemoteConfig): Promise<void> {
  const sshClient = new NodeSSH();

  try {
    await sshClient.connect({
      host: config.ipAddress,
      readyTimeout: DEFAULT_TIMEOUT,
      ...config.ssh,
    });
    const ShutdownCommand = await getShutdownCommand(sshClient);
    try {
      await sshClient.execCommand(ShutdownCommand);
    } catch (err) {
      // Timed out while waiting for handshake
      logger.silly(err);
    }
  } catch (err) {
    logger.error("Error executing shutdown command:", err);
  } finally {
    sshClient.dispose();
  }
}
