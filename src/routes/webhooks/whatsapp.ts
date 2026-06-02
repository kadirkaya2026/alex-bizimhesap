import { Router, type Request, type Response } from "express";
import { logger } from "../../lib/logger.js";
import { processWhatsAppWebhookPayload } from "../../jobs/process-inbound.js";
import { verifyWebhookChallenge } from "../../services/whatsapp/verify.js";
import { verifyWhatsAppSignature } from "../../services/whatsapp/signature.js";

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/", (req: Request, res: Response) => {
  const challenge = verifyWebhookChallenge({
    mode: req.query["hub.mode"] as string | undefined,
    verifyToken: req.query["hub.verify_token"] as string | undefined,
    challenge: req.query["hub.challenge"] as string | undefined,
  });

  if (challenge) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
});

whatsappWebhookRouter.post("/", (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  const signature = req.get("X-Hub-Signature-256");

  if (!Buffer.isBuffer(rawBody)) {
    res.sendStatus(400);
    return;
  }

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    logger.warn("Invalid WhatsApp signature");
    res.sendStatus(401);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.sendStatus(400);
    return;
  }

  res.sendStatus(200);

  setImmediate(() => {
    processWhatsAppWebhookPayload(parsed).catch((error) => {
      logger.error({ error }, "Async webhook processing failed");
    });
  });
});
