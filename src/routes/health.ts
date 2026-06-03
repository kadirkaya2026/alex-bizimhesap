import { Router } from "express";
import { getEnv, isBizimhesapConfigured } from "../config/env.js";
import { pingDatabase } from "../db/client.js";
import {
  getWhatsAppHealthInfo,
  probeWhatsAppToken,
} from "../services/whatsapp/token-health.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const dbUp = await pingDatabase();
  const env = getEnv();
  const firmId = env.BIZIMHESAP_FIRM_ID?.trim() ?? "";
  const whatsappStatic = getWhatsAppHealthInfo();
  const whatsappProbe = whatsappStatic.configured
    ? await probeWhatsAppToken()
    : { ok: false, status: 0 };

  res.status(dbUp ? 200 : 503).json({
    ok: dbUp,
    service: "alex-bizimhesap",
    version: "0.1.0",
    db: dbUp ? "up" : "down",
    whatsapp: {
      ...whatsappStatic,
      graphApiOk: whatsappProbe.ok,
      graphApiStatus: whatsappProbe.status || null,
      verifiedName: whatsappProbe.verifiedName ?? null,
    },
    bizimhesap: {
      configured: isBizimhesapConfigured(),
      firmIdLength: firmId.length,
      firmIdSuffix: firmId.length >= 4 ? firmId.slice(-4) : null,
      invalidPlaceholder:
        firmId === "REPLACE_FIRM_ID" || firmId.length === 0,
    },
    railway: {
      projectId: process.env.RAILWAY_PROJECT_ID ?? null,
      serviceName: process.env.RAILWAY_SERVICE_NAME ?? null,
    },
  });
});
