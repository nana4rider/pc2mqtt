import { cleanEnv, num, str } from "envalid";

const env = cleanEnv(process.env, {
  MQTT_BROKER: str(),
  MQTT_USERNAME: str({ default: undefined }),
  MQTT_PASSWORD: str({ default: undefined }),
  LOG_LEVEL: str({ default: "info" }),
  HA_DISCOVERY_PREFIX: str({ default: "homeassistant" }),
  PORT: num({ default: 3000 }),
  MQTT_TASK_INTERVAL: num({ default: 100 }),
  ENTITY_QOS: num({ choices: [0, 1, 2], default: 1 }),
  AVAILABILITY_INTERVAL: num({ default: 10000 }),
  STATE_CHANGE_PAUSE_DURATION: num({ default: 30000 }),
  CHECK_ALIVE_INTERVAL: num({ default: 5000 }),
});

export default env;
