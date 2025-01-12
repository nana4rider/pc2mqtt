import { RemoteConfig } from "@/entity";
import logger from "@/logger";
import env from "env-var";
import ping from "ping";

// 状態を確認する間隔
const CHECK_ALIVE_INTERVAL = env
  .get("CHECK_ALIVE_INTERVAL")
  .default(5000)
  .asInt();

export type Alive = {
  readonly lastAlive: boolean;
  addListener: (listener: (isAlive: boolean) => void) => void;
  close: () => void;
};

export async function requestAlive(config: RemoteConfig): Promise<Alive> {
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
    CHECK_ALIVE_INTERVAL,
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
