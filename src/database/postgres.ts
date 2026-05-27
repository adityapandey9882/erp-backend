import { Pool } from "pg";
import { databaseConfig } from "../config/database.config.js";

export const postgresPool = new Pool({
  connectionString: databaseConfig.url || undefined,
  max: databaseConfig.poolMax,
  ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : false,
});

postgresPool.on("error", (error) => {
  console.error("Unexpected PostgreSQL idle client error.", error);
});
