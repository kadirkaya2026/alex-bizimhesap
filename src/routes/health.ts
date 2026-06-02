import { Router } from "express";
import { pingDatabase } from "../db/client.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const dbUp = await pingDatabase();
  res.status(dbUp ? 200 : 503).json({
    ok: dbUp,
    service: "alex-bizimhesap",
    version: "0.1.0",
    db: dbUp ? "up" : "down",
  });
});
