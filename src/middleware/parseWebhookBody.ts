import type { Request, Response, NextFunction } from "express";

export function parseWebhookBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    res.sendStatus(400);
    return;
  }

  try {
    req.webhookPayload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.sendStatus(400);
    return;
  }

  next();
}
