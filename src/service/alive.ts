import { RemoteConfig } from "@/entity";
import env from "@/env";
import logger from "@/logger";
import ping from "ping";

export type Alive = {
  readonly lastAlive: boolean;
  addListener: (listener: (isAlive: boolean) => void) => void;
  close: () => void;
};

export default async function requestAlive(
  config: RemoteConfig,
): Promise<Alive> {
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
  const intervalId = setInterval(
    () => void intervalHandler(),
    env.CHECK_ALIVE_INTERVAL,
  );

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
