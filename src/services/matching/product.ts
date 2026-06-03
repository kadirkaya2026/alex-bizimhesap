import { prisma } from "../../db/client.js";
import type { OrderDraftLine } from "../parser/order-draft.schema.js";
import type { CatalogCache } from "./catalog.js";
import { findProductInCatalog } from "./catalog.js";
import type { MatchSource } from "./customer.js";

export interface ResolvedProductLine {
  productId?: string;
  name: string;
  sku?: string;
  source: MatchSource;
}

async function learnProductMapping(
  tenantId: string,
  line: OrderDraftLine,
  bizimhesapProductId: string,
): Promise<void> {
  const localName = line.name.trim();
  const localSku = line.sku?.trim() || null;

  await prisma.productMapping.upsert({
    where: {
      tenantId_localName: { tenantId, localName },
    },
    create: {
      tenantId,
      localName,
      localSku,
      bizimhesapProductId,
    },
    update: {
      bizimhesapProductId,
      ...(localSku ? { localSku } : {}),
    },
  });
}

export async function resolveProductLine(
  tenantId: string,
  line: OrderDraftLine,
  catalog?: CatalogCache,
): Promise<ResolvedProductLine> {
  const name = line.name.trim();
  const sku = line.sku?.trim();

  if (sku) {
    const bySku = await prisma.productMapping.findFirst({
      where: { tenantId, localSku: sku },
    });
    if (bySku?.bizimhesapProductId) {
      return {
        productId: bySku.bizimhesapProductId,
        name,
        sku,
        source: "db",
      };
    }
  }

  const byName = await prisma.productMapping.findFirst({
    where: {
      tenantId,
      localName: { equals: name, mode: "insensitive" },
    },
  });
  if (byName?.bizimhesapProductId) {
    return {
      productId: byName.bizimhesapProductId,
      name,
      sku,
      source: "db",
    };
  }

  if (catalog) {
    const found = await findProductInCatalog(catalog, line);
    if (found) {
      await learnProductMapping(tenantId, line, found.id);
      return {
        productId: found.id,
        name,
        sku,
        source: "catalog",
      };
    }
  }

  return { name, sku, source: "none" };
}

/** @deprecated Use resolveProductLine */
export async function resolveProductId(
  tenantId: string,
  line: OrderDraftLine,
): Promise<string | undefined> {
  const resolved = await resolveProductLine(tenantId, line);
  return resolved.productId;
}
