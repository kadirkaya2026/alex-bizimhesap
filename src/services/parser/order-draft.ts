import OpenAI from "openai";
import { getEnv, isOpenAiConfigured } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import {
  buildOrderDraftUserPrompt,
  ORDER_DRAFT_SYSTEM_PROMPT,
} from "./prompts.js";
import { orderDraftSchema, type OrderDraft } from "./order-draft.schema.js";

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
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ORDER_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: buildOrderDraftUserPrompt(pdfText) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new AppError("GPT boş yanıt döndü", "GPT_EMPTY_RESPONSE");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error({ raw }, "GPT JSON parse failed");
    throw new AppError("GPT geçersiz JSON döndü", "GPT_INVALID_JSON");
  }

  const result = orderDraftSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ issues: result.error.flatten() }, "OrderDraft validation failed");
    throw new AppError(
      "Fiş verisi doğrulanamadı. PDF net mi kontrol edin.",
      "DRAFT_VALIDATION_FAILED",
    );
  }

  return result.data;
}
