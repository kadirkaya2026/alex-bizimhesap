import { prisma } from "../../db/client.js";
import type { OrderDraftLine } from "../parser/order-draft.schema.js";
import type { CatalogCache } from "./catalog.js";
import { searchProductInCatalog } from "./catalog.js";
import { extractLineCodeCandidates } from "./extract-codes.js";
import { normalizeCode } from "./score.js";
import type { MatchSource } from "./customer.js";
import type { MatchSuggestion } from "./types.js";

export interface ResolvedProductLine {
  productId?: string;
  name: string;
  sku?: string;
  source: MatchSource;
  suggestion?: MatchSuggestion;
}

async function learnProductMapping(
  tenantId: string,
  line: OrderDraftLine,
  bizimhesapProductId: string,
): Promise<void> {
  const localName = line.name.trim();
  const localSku = line.sku?.trim() || extractLineCodeCandidates(line)[0] || null;

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

  if (localSku) {
    const existingSku = await prisma.productMapping.findFirst({
      where: { tenantId, localSku },
    });
    if (!existingSku) {
      try {
        await prisma.productMapping.create({
          data: {
            tenantId,
            localName: `${localName} [${localSku}]`,
            localSku,
            bizimhesapProductId,
          },
        });
      } catch {
        // unique conflict on local_name — ignore
      }
    }
  }
}

export async function resolveProductLine(
  tenantId: string,
  line: OrderDraftLine,
  catalog?: CatalogCache,
  lineIndex = 0,
  manualProductId?: string,
): Promise<ResolvedProductLine> {
  const name = line.name.trim();
  const sku = line.sku?.trim();
  const codeCandidates = extractLineCodeCandidates(line);

  if (manualProductId) {
    return {
      productId: manualProductId,
      name,
      sku,
      source: "manual",
    };
  }

  for (const code of codeCandidates) {
    const bySku = await prisma.productMapping.findFirst({
      where: { tenantId, localSku: code },
    });
    if (bySku?.bizimhesapProductId) {
      return {
        productId: bySku.bizimhesapProductId,
        name,
        sku: code,
        source: "db",
      };
    }

    const bySkuName = await prisma.productMapping.findFirst({
      where: {
        tenantId,
        localName: { equals: code, mode: "insensitive" },
      },
    });
    if (bySkuName?.bizimhesapProductId) {
      return {
        productId: bySkuName.bizimhesapProductId,
        name,
        sku: code,
        source: "db",
      };
    }
  }

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
    const result = await searchProductInCatalog(catalog, line, lineIndex);
    if (result.matched) {
      await learnProductMapping(tenantId, line, result.matched.id);
      return {
        productId: result.matched.id,
        name,
        sku: sku ?? codeCandidates.find((c) =>
          result.matched!.codes.some((pc) => normalizeCode(pc) === normalizeCode(c)),
        ),
        source: "catalog",
      };
    }
    if (result.suggestion) {
      return { name, sku, source: "none", suggestion: result.suggestion };
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
