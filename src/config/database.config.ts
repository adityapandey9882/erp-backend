import { env } from "./env.js";

export const databaseConfig = {
  client: "postgresql",
  url: env.databaseUrl,
  poolMax: env.databasePoolMax,
  ssl: env.databaseSsl,
};
