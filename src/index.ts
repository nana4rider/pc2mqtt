import { Entity } from "@/entity";
import logger from "@/logger";
import { setupAvailability } from "@/manager/availabilityManager";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import { requestAlive } from "@/service/alive";
import initializeHttpServer from "@/service/http";
import fs from "fs/promises";

type Config = {
  deviceId: string;
  entities: Entity[];
};

async function main() {
  logger.info("start");

  const { deviceId, entities } = JSON.parse(
    await fs.readFile("./config.json", "utf-8"),
  ) as Config;
  const alives = new Map(
    await Promise.all(
      entities.map(async ({ id: uniqueId, remote }) => {
        const alive = await requestAlive(remote);
        return [uniqueId, alive] as const;
      }),
    ),
  );
  const mqtt = await setupMqttDeviceManager(deviceId, entities, alives);
  const http = await initializeHttpServer();
  const availability = setupAvailability(deviceId, entities, mqtt);

  const handleShutdown = async () => {
    logger.info("shutdown");
    alives.forEach((alive) => alive.close());
    availability.close();
    await mqtt.close(true);
    await http.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void handleShutdown());
  process.on("SIGTERM", () => void handleShutdown());

  availability.pushOnline();

  logger.info("ready");
}

process.on("uncaughtException", (reason) => {
  if (reason.message.includes("ECONNRESET")) {
    // https://github.com/steelbrain/node-ssh/issues/421
    logger.debug("Uncaught Exception at:", reason);
  } else {
    throw reason;
  }
});

try {
  await main();
} catch (err) {
  logger.error("main() error:", err);
  process.exit(1);
}
