import express from "express";
import { appConfig } from "./config/app.config.js";
import {
  corsMiddleware,
  errorMiddleware,
  notFoundHandler,
} from "./core/middleware/index.js";
import router from "./routes/index.js";

const app = express();
const requestBodyLimit = "40mb";

app.disable("x-powered-by");
app.use(corsMiddleware);
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(appConfig.apiPrefix, router);
app.use(notFoundHandler);
app.use(errorMiddleware);

export default app;
