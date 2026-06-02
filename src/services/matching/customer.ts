import { prisma } from "../../db/client.js";
import type { OrderDraft } from "../parser/order-draft.schema.js";

export async function resolveCustomerMapping(
  tenantId: string,
  draft: OrderDraft,
): Promise<{ customerId?: string; title: string }> {
  const mapping = await prisma.customerMapping.findFirst({
    where: {
      tenantId,
      localName: { equals: draft.customerName.trim(), mode: "insensitive" },
    },
  });

  if (mapping?.bizimhesapCustomerId) {
    return {
      customerId: mapping.bizimhesapCustomerId,
      title: draft.customerName.trim(),
    };
  }

  return { title: draft.customerName.trim() };
}
