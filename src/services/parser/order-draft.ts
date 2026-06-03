import OpenAI from "openai";
import { getEnv, isOpenAiConfigured } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { ORDER_DRAFT_JSON_SCHEMA } from "./order-draft.openai-schema.js";
import {
  buildOrderDraftUserPrompt,
  ORDER_DRAFT_SYSTEM_PROMPT,
} from "./prompts.js";
import {
  normalizeOrderDraft,
  orderDraftSchema,
  type OrderDraft,
} from "./order-draft.schema.js";
import { repairOrderDraftFromPdfText } from "./repair-order-draft.js";

function parseCompletionContent(raw: string | null | undefined): unknown {
  if (!raw) {
    throw new AppError("GPT boş yanıt döndü", "GPT_EMPTY_RESPONSE");
  }
  try {
    return JSON.parse(raw);
  } catch {
    logger.error({ raw }, "GPT JSON parse failed");
    throw new AppError("GPT geçersiz JSON döndü", "GPT_INVALID_JSON");
  }
}

export async function parseOrderDraftFromPdfText(pdfText: string): Promise<OrderDraft> {
  if (!isOpenAiConfigured()) {
    throw new AppError(
      "OpenAI yapılandırılmamış. OPENAI_API_KEY gerekli.",
      "OPENAI_NOT_CONFIGURED",
      503,
    );
  }

  const env = getEnv();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "order_draft",
        strict: true,
        schema: ORDER_DRAFT_JSON_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: ORDER_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: buildOrderDraftUserPrompt(pdfText) },
    ],
  });

  const message = completion.choices[0]?.message;
  const parsed =
    message && "parsed" in message && message.parsed != null
      ? message.parsed
      : parseCompletionContent(message?.content);

  const result = orderDraftSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ issues: result.error.flatten() }, "OrderDraft validation failed");
    throw new AppError(
      "Fiş verisi doğrulanamadı. PDF net mi kontrol edin.",
      "DRAFT_VALIDATION_FAILED",
    );
  }

  return repairOrderDraftFromPdfText(pdfText, normalizeOrderDraft(result.data));
}
