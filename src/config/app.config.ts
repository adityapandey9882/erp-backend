import { env } from "./env.js";

export const appConfig = {
  name: env.appName,
  apiPrefix: env.apiPrefix,
  environment: env.nodeEnv,
  cors: {
    allowedOrigins: env.corsAllowedOrigins,
    allowCredentials: env.corsAllowCredentials,
  },
};
