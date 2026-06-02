import express from "express";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.js";
import { whatsappWebhookRouter } from "./routes/webhooks/whatsapp.js";

const app = express();

app.use(healthRouter);

app.use(
  "/webhooks/whatsapp",
  express.raw({ type: "application/json", limit: "2mb" }),
  whatsappWebhookRouter,
);

app.use(express.json({ limit: "1mb" }));

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const env = getEnv();
const port = env.PORT;

const server = app.listen(port, () => {
  logger.info({ port, nodeEnv: env.NODE_ENV }, "alex-bizimhesap started");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
