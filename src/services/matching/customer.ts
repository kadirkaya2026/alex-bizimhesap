import { prisma } from "../../db/client.js";
import type { OrderDraft } from "../parser/order-draft.schema.js";
import type { CatalogCache } from "./catalog.js";
import { searchCustomerInCatalog } from "./catalog.js";
import type { MatchSuggestion } from "./types.js";

export type MatchSource = "db" | "catalog" | "manual" | "fallback" | "none";

export interface ResolvedCustomer {
  customerId?: string;
  title: string;
  bizimhesapTitle?: string;
  matchScore?: number;
  source: MatchSource;
  suggestion?: MatchSuggestion;
}

async function learnCustomerMapping(
  tenantId: string,
  localName: string,
  bizimhesapCustomerId: string,
): Promise<void> {
  await prisma.customerMapping.upsert({
    where: {
      tenantId_localName: { tenantId, localName },
    },
    create: {
      tenantId,
      localName,
      bizimhesapCustomerId,
    },
    update: {
      bizimhesapCustomerId,
    },
  });
}

export async function resolveCustomerMapping(
  tenantId: string,
  draft: OrderDraft,
  catalog?: CatalogCache,
  manualCustomerId?: string,
): Promise<ResolvedCustomer> {
  const title = draft.customerName.trim();

  if (manualCustomerId) {
    return {
      customerId: manualCustomerId,
      title,
      source: "manual",
    };
  }

  const mapping = await prisma.customerMapping.findFirst({
    where: {
      tenantId,
      localName: { equals: title, mode: "insensitive" },
    },
  });

  if (mapping?.bizimhesapCustomerId) {
    return {
      customerId: mapping.bizimhesapCustomerId,
      title,
      source: "db",
    };
  }

  if (catalog) {
    const result = await searchCustomerInCatalog(catalog, draft);
    if (result.matched) {
      await learnCustomerMapping(tenantId, title, result.matched.id);
      return {
        customerId: result.matched.id,
        title,
        bizimhesapTitle: result.matched.title,
        matchScore: result.matchScore,
        source: "catalog",
      };
    }
    if (result.suggestion) {
      return { title, source: "none", suggestion: result.suggestion };
    }
  }

  return { title, source: "none" };
}
