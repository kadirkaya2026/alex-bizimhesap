import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";
import { verifyWhatsAppSignature as verifySignature } from "../services/whatsapp/signature.js";

export function verifyWhatsAppSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    res.sendStatus(400);
    return;
  }

  const signature = req.get("X-Hub-Signature-256");

  if (!verifySignature(rawBody, signature)) {
    logger.warn("Invalid WhatsApp signature");
    res.sendStatus(401);
    return;
  }

  next();
}
