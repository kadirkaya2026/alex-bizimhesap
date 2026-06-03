import type { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { processWhatsAppWebhookPayload } from "../jobs/process-inbound.js";

export function enqueueInbound(req: Request, res: Response): void {
  const payload = req.webhookPayload;

  res.sendStatus(200);

  setImmediate(() => {
    processWhatsAppWebhookPayload(payload).catch((error) => {
      logger.error({ error }, "Async webhook processing failed");
    });
  });
}
