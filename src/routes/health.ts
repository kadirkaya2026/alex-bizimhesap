import { Router } from "express";
import { getEnv, isBizimhesapConfigured } from "../config/env.js";
import { pingDatabase, prisma } from "../db/client.js";
import { CatalogCache } from "../services/matching/catalog.js";
import {
  getWhatsAppHealthInfo,
  probeWhatsAppToken,
} from "../services/whatsapp/token-health.js";

export const healthRouter = Router();

async function getMappingStats() {
  const [customers, products] = await Promise.all([
    prisma.customerMapping.count(),
    prisma.productMapping.count(),
  ]);

  let catalogCustomersParsed: number | null = null;
  let catalogProductsParsed: number | null = null;
  let catalogCustomersRaw: number | null = null;
  let catalogProductsRaw: number | null = null;

  const env = getEnv();
  const firmId = env.BIZIMHESAP_FIRM_ID?.trim();
  const apiKey = env.BIZIMHESAP_API_KEY?.trim();
  if (
    firmId &&
    firmId !== "REPLACE_FIRM_ID" &&
    apiKey &&
    apiKey !== "REPLACE_API_KEY" &&
    isBizimhesapConfigured()
  ) {
    try {
      const cache = new CatalogCache(firmId, apiKey);
      await cache.getCustomers();
      await cache.getProducts();
      const stats = cache.getStats();
      catalogCustomersParsed = stats.parsedCustomers;
      catalogProductsParsed = stats.parsedProducts;
      catalogCustomersRaw = stats.rawCustomerCount;
      catalogProductsRaw = stats.rawProductCount;
    } catch {
      // catalog probe optional on health
    }
  }

  return {
    customers,
    products,
    catalogCustomersParsed,
    catalogProductsParsed,
    catalogCustomersRaw,
    catalogProductsRaw,
  };
}

healthRouter.get("/health", async (_req, res) => {
  const dbUp = await pingDatabase();
  const env = getEnv();
  const firmId = env.BIZIMHESAP_FIRM_ID?.trim() ?? "";
  const whatsappStatic = getWhatsAppHealthInfo();
  const whatsappProbe = whatsappStatic.configured
    ? await probeWhatsAppToken()
    : { ok: false, status: 0 };

  const mappings = dbUp ? await getMappingStats() : null;

  const fallbackCustomerId = env.BIZIMHESAP_FALLBACK_CUSTOMER_ID?.trim();
  const fallbackProductId = env.BIZIMHESAP_FALLBACK_PRODUCT_ID?.trim();

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
      fallbackCustomerId: fallbackCustomerId ? "SET" : "MISSING",
      fallbackProductId: fallbackProductId ? "SET" : "MISSING",
      fuzzyMatchThreshold: env.FUZZY_MATCH_THRESHOLD,
    },
    mappings,
    railway: {
      projectId: process.env.RAILWAY_PROJECT_ID ?? null,
      serviceName: process.env.RAILWAY_SERVICE_NAME ?? null,
    },
  });
});
