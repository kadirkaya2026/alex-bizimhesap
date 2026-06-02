import { prisma } from "../../db/client.js";
import type { OrderDraftLine } from "../parser/order-draft.schema.js";

export async function resolveProductId(
  tenantId: string,
  line: OrderDraftLine,
): Promise<string | undefined> {
  if (line.sku) {
    const bySku = await prisma.productMapping.findFirst({
      where: {
        tenantId,
        localSku: line.sku,
      },
    });
    if (bySku?.bizimhesapProductId) return bySku.bizimhesapProductId;
  }

  const byName = await prisma.productMapping.findFirst({
    where: {
      tenantId,
      localName: { equals: line.name.trim(), mode: "insensitive" },
    },
  });

  return byName?.bizimhesapProductId ?? undefined;
}
