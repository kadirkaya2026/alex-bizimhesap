import type { InvoiceJob } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { ConversationState } from "./state.js";
import { InvoiceJobStatus } from "./invoice-job-status.js";

export async function findLatestAwaitingConfirmJob(
  tenantId: string,
  phoneE164: string,
): Promise<InvoiceJob | null> {
  return prisma.invoiceJob.findFirst({
    where: {
      tenantId,
      phoneE164,
      status: InvoiceJobStatus.PREVIEW,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function ensureConversationAwaitingConfirm(
  tenantId: string,
  phoneE164: string,
  invoiceJobId: string,
): Promise<void> {
  await prisma.conversation.upsert({
    where: { tenantId_phoneE164: { tenantId, phoneE164 } },
    create: {
      tenantId,
      phoneE164,
      state: ConversationState.AWAITING_CONFIRM,
      contextJson: { invoiceJobId },
    },
    update: {
      state: ConversationState.AWAITING_CONFIRM,
      contextJson: { invoiceJobId },
    },
  });
}
