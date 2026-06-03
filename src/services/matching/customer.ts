import { prisma } from "../../db/client.js";
import type { OrderDraft } from "../parser/order-draft.schema.js";
import type { CatalogCache } from "./catalog.js";
import { findCustomerInCatalog } from "./catalog.js";

export type MatchSource = "db" | "catalog" | "none";

export interface ResolvedCustomer {
  customerId?: string;
  title: string;
  source: MatchSource;
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
): Promise<ResolvedCustomer> {
  const title = draft.customerName.trim();

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
    const found = await findCustomerInCatalog(catalog, draft);
    if (found) {
      await learnCustomerMapping(tenantId, title, found.id);
      return {
        customerId: found.id,
        title,
        source: "catalog",
      };
    }
  }

  return { title, source: "none" };
}
