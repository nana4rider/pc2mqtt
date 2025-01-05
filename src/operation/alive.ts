import { RemoteConfig } from "@/entity";
import logger from "@/logger";
import ping from "ping";

export async function requestAlive(config: RemoteConfig, intervalMs: number) {
  const getAlive = async (): Promise<boolean> => {
    try {
      const { alive } = await ping.promise.probe(config.ipAddress, {
        timeout: 1,
      });
      return alive;
    } catch (err) {
      logger.error("Error pinging host:", err);
      return false;
    }
  };

  let lastAlive = await getAlive();

  const listeners: Set<(isAlive: boolean) => void> = new Set();
  const intervalHandler = async () => {
    lastAlive = await getAlive();
    listeners.forEach((listener) => listener(lastAlive));
  };
  const intervalId = setInterval(() => void intervalHandler(), intervalMs);

  return {
    get lastAlive() {
      return lastAlive;
    },
    addListener: (listener: (isAlive: boolean) => void) => {
      listeners.add(listener);
    },
    close: () => {
      clearInterval(intervalId);
      listeners.clear();
    },
  };
}
