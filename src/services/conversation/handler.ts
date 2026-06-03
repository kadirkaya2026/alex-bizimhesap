import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { hashDraft } from "../../lib/hash.js";
import { getErrorMessage } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import {
  buildAddInvoicePayload,
  postAddInvoice,
} from "../bizimhesap/invoice.js";
import { resolveCustomerMapping } from "../matching/customer.js";
import { resolveProductId } from "../matching/product.js";
import { parseOrderDraftFromPdfText } from "../parser/order-draft.js";
import {
  extractStorefrontPdfUrlFromText,
  getPdfTextFromBuffer,
  getPdfTextFromUrl,
} from "../parser/pdf.js";
import type { OrderDraft } from "../parser/order-draft.schema.js";
import type { ResolvedTenant } from "../tenant/resolve.js";
import type { InboundMessage } from "../whatsapp/inbound.js";
import { downloadWhatsAppMedia } from "../whatsapp/media.js";
import {
  formatPreviewMessage,
  sendWhatsAppText,
} from "../whatsapp/outbound.js";
import {
  ensureConversationAwaitingConfirm,
  findLatestAwaitingConfirmJob,
} from "./invoice-job.js";
import { InvoiceJobStatus } from "./invoice-job-status.js";
import {
  ConversationState,
  isCancelCommand,
  isConfirmCommand,
  isHelpCommand,
} from "./state.js";

const HELP_TEXT = `Alex Bizimhesap asistanı

• eKatalox PDF linki veya PDF dosyası gönderin
• Özet geldikten sonra ONAYLA yazın
• İPTAL ile işlemi iptal edin

Not: Dekont fotoğrafı desteği yakında eklenecek.`;

async function setConversationState(
  tenantId: string,
  phoneE164: string,
  state: string,
  context?: { invoiceJobId?: string; lastDraftHash?: string },
) {
  await prisma.conversation.upsert({
    where: { tenantId_phoneE164: { tenantId, phoneE164 } },
    create: {
      tenantId,
      phoneE164,
      state,
      contextJson: (context ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      state,
      contextJson: (context ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

function formatDraftTotal(draft: OrderDraft): string {
  if (draft.total != null) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(draft.total);
  }
  const sum = draft.lines.reduce((s, l) => s + l.qty * l.unitPrice * 1.2, 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(sum);
}

async function checkDuplicateOrder(
  tenantId: string,
  orderNumber: string | undefined,
): Promise<string | null> {
  if (!orderNumber) return null;
  const existing = await prisma.invoiceJob.findUnique({
    where: { tenantId_orderNumber: { tenantId, orderNumber } },
  });
  if (
    existing &&
    (existing.status === InvoiceJobStatus.SUCCESS ||
      existing.status === "posted") &&
    existing.bizimhesapGuid
  ) {
    return existing.bizimhesapGuid;
  }
  return null;
}

async function createPreviewJob(
  tenant: ResolvedTenant,
  draft: OrderDraft,
  whatsappMsgId: string,
) {
  const draftHash = hashDraft(draft);

  const duplicate = await checkDuplicateOrder(
    tenant.tenantId,
    draft.orderNumber ?? undefined,
  );
  if (duplicate) {
    await sendWhatsAppText(
      tenant.phoneE164,
      `Bu sipariş zaten fişlendi.\nBizimhesap referans: ${duplicate}`,
    );
    return;
  }

  const job = await prisma.invoiceJob.create({
    data: {
      tenantId: tenant.tenantId,
      phoneE164: tenant.phoneE164,
      orderNumber: draft.orderNumber ?? null,
      draftJson: draft as object,
      draftHash,
      status: InvoiceJobStatus.PREVIEW,
      whatsappMsgId,
    },
  });

  await ensureConversationAwaitingConfirm(
    tenant.tenantId,
    tenant.phoneE164,
    job.id,
  );

  await sendWhatsAppText(
    tenant.phoneE164,
    formatPreviewMessage({
      customerName: draft.customerName,
      orderNumber: draft.orderNumber ?? undefined,
      lineCount: draft.lines.length,
      total: formatDraftTotal(draft),
    }),
  );
}

async function processPdfText(
  tenant: ResolvedTenant,
  pdfText: string,
  messageId: string,
) {
  await setConversationState(
    tenant.tenantId,
    tenant.phoneE164,
    ConversationState.PARSING,
  );

  const draft = await parseOrderDraftFromPdfText(pdfText);
  await createPreviewJob(tenant, draft, messageId);
}

async function handleConfirm(tenant: ResolvedTenant) {
  const job = await findLatestAwaitingConfirmJob(
    tenant.tenantId,
    tenant.phoneE164,
  );

  if (!job) {
    await sendWhatsAppText(
      tenant.phoneE164,
      "Onaylanacak bir fiş özeti yok. Önce PDF veya link gönderin.",
    );
    return;
  }

  const conv = await prisma.conversation.findUnique({
    where: {
      tenantId_phoneE164: {
        tenantId: tenant.tenantId,
        phoneE164: tenant.phoneE164,
      },
    },
  });

  if (conv && conv.state !== ConversationState.AWAITING_CONFIRM) {
    await setConversationState(
      tenant.tenantId,
      tenant.phoneE164,
      ConversationState.AWAITING_CONFIRM,
      { invoiceJobId: job.id },
    );
  }

  await setConversationState(
    tenant.tenantId,
    tenant.phoneE164,
    ConversationState.POSTING,
    { invoiceJobId: job.id },
  );

  const draft = job.draftJson as OrderDraft;
  const customer = await resolveCustomerMapping(tenant.tenantId, draft);

  const productIds: (string | undefined)[] = [];
  for (let i = 0; i < draft.lines.length; i++) {
    productIds.push(await resolveProductId(tenant.tenantId, draft.lines[i]!));
  }

  const payload = buildAddInvoicePayload({
    draft,
    firmId: tenant.bizimhesapFirmId,
    defaultTaxRate: tenant.defaultTaxRate,
    defaultDueDays: tenant.defaultDueDays,
    defaultCurrency: tenant.defaultCurrency,
    customerId: customer.customerId,
    productIdByLine: (_line, index) => productIds[index],
  });

  try {
    const result = await postAddInvoice(payload, tenant.bizimhesapApiKey);

    if (result.error) {
      logger.warn(
        {
          jobId: job.id,
          error: result.error,
          firmIdPrefix: payload.firmId.slice(0, 4),
          firmIdLength: payload.firmId.length,
        },
        "addinvoice rejected by Bizimhesap",
      );
      await prisma.invoiceJob.update({
        where: { id: job.id },
        data: { status: InvoiceJobStatus.FAILED, errorMessage: result.error },
      });
      await setConversationState(tenant.tenantId, tenant.phoneE164, ConversationState.AWAITING_CONFIRM, {
        invoiceJobId: job.id,
      });
      await sendWhatsAppText(
        tenant.phoneE164,
        `Bizimhesap hatası: ${result.error}`,
      );
      return;
    }

    await prisma.invoiceJob.update({
      where: { id: job.id },
      data: {
        status: InvoiceJobStatus.SUCCESS,
        bizimhesapGuid: result.guid,
        bizimhesapUrl: result.url,
        postedAt: new Date(),
        errorMessage: null,
      },
    });

    await setConversationState(
      tenant.tenantId,
      tenant.phoneE164,
      ConversationState.IDLE,
    );

    await sendWhatsAppText(
      tenant.phoneE164,
      `Fişlendi.\nReferans: ${result.guid}\n${result.url ? `Link: ${result.url}` : ""}`,
    );
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error({ error, jobId: job.id }, "addinvoice failed");
    await prisma.invoiceJob.update({
      where: { id: job.id },
      data: { status: InvoiceJobStatus.FAILED, errorMessage: msg },
    });
    await setConversationState(tenant.tenantId, tenant.phoneE164, ConversationState.AWAITING_CONFIRM, {
      invoiceJobId: job.id,
    });
    await sendWhatsAppText(
      tenant.phoneE164,
      `Fişleme başarısız: ${msg}`,
    );
  }
}

async function handleCancel(tenant: ResolvedTenant) {
  const job = await findLatestAwaitingConfirmJob(
    tenant.tenantId,
    tenant.phoneE164,
  );

  if (job) {
    await prisma.invoiceJob.update({
      where: { id: job.id },
      data: { status: InvoiceJobStatus.CANCELLED },
    });
  }

  await setConversationState(
    tenant.tenantId,
    tenant.phoneE164,
    ConversationState.IDLE,
  );
  await sendWhatsAppText(tenant.phoneE164, "İşlem iptal edildi.");
}

export async function handleInboundMessage(
  tenant: ResolvedTenant,
  message: InboundMessage,
): Promise<void> {
  await prisma.inboundMessageLog.create({
    data: {
      tenantId: tenant.tenantId,
      phoneE164: tenant.phoneE164,
      messageType: message.type,
      payloadJson: message as object,
    },
  });

  if (message.type === "text") {
    if (isHelpCommand(message.text)) {
      await sendWhatsAppText(tenant.phoneE164, HELP_TEXT);
      return;
    }
    if (isConfirmCommand(message.text)) {
      await handleConfirm(tenant);
      return;
    }
    if (isCancelCommand(message.text)) {
      await handleCancel(tenant);
      return;
    }

    const pdfUrl = extractStorefrontPdfUrlFromText(message.text);
    if (pdfUrl) {
      try {
        const text = await getPdfTextFromUrl(pdfUrl);
        await processPdfText(tenant, text, message.messageId);
      } catch (error) {
        await sendWhatsAppText(
          tenant.phoneE164,
          `PDF işlenemedi: ${getErrorMessage(error)}`,
        );
      }
      return;
    }

    await sendWhatsAppText(
      tenant.phoneE164,
      "PDF dosyası veya eKatalox PDF linki gönderin. Yardım için: yardım",
    );
    return;
  }

  if (message.type === "document") {
    const isPdf =
      message.mimeType === "application/pdf" ||
      message.filename?.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      await sendWhatsAppText(
        tenant.phoneE164,
        "Lütfen PDF formatında sipariş fişi gönderin.",
      );
      return;
    }

    try {
      const buffer = await downloadWhatsAppMedia(message.mediaId);
      const text = await getPdfTextFromBuffer(buffer);
      await processPdfText(tenant, text, message.messageId);
    } catch (error) {
      await sendWhatsAppText(
        tenant.phoneE164,
        `PDF işlenemedi: ${getErrorMessage(error)}`,
      );
    }
    return;
  }

  if (message.type === "image") {
    await sendWhatsAppText(
      tenant.phoneE164,
      "Dekont fotoğrafı desteği yakında. Şimdilik PDF veya link gönderin.",
    );
  }
}
