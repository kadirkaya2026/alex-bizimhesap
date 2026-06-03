import { Router, type Request, type Response } from "express";
import { enqueueInbound } from "../../middleware/enqueueInbound.js";
import { parseWebhookBody } from "../../middleware/parseWebhookBody.js";
import { verifyWhatsAppSignature } from "../../middleware/verifyWhatsAppSignature.js";
import { whatsappRawBody } from "../../middleware/whatsappRawBody.js";
import { verifyWebhookChallenge } from "../../services/whatsapp/verify.js";

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

whatsappWebhookRouter.post(
  "/",
  whatsappRawBody,
  verifyWhatsAppSignature,
  parseWebhookBody,
  enqueueInbound,
);
