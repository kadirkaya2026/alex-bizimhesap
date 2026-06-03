import express from "express";
import {
  assertBizimhesapConfigForProduction,
  getEnv,
  isWhatsAppConfigured,
} from "./config/env.js";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.js";
import { whatsappWebhookRouter } from "./routes/webhooks/whatsapp.js";
import { probeWhatsAppToken } from "./services/whatsapp/token-health.js";

const app = express();

app.use(healthRouter);

app.use("/webhooks/whatsapp", whatsappWebhookRouter);

app.use(express.json({ limit: "1mb" }));

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const env = getEnv();
assertBizimhesapConfigForProduction();
const port = env.PORT;

const server = app.listen(port, () => {
  logger.info({ port, nodeEnv: env.NODE_ENV }, "alex-bizimhesap started");

  if (isWhatsAppConfigured()) {
    void probeWhatsAppToken().then((result) => {
      if (!result.ok) {
        logger.error(
          {
            graphApiStatus: result.status,
          },
          "WHATSAPP_ACCESS_TOKEN geçersiz — Meta panelden yeni kalıcı token alın ve redeploy edin",
        );
      } else {
        logger.info(
          {
            verifiedName: result.verifiedName,
            displayPhoneNumber: result.displayPhoneNumber,
          },
          "WhatsApp token doğrulandı",
        );
      }
    });
  } else {
    logger.warn("WhatsApp yapılandırılmamış — cevap gönderilemez");
  }
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
