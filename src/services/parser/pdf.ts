import pdfParse from "pdf-parse";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

const EKATALOX_PDF_URL_REGEX =
  /https?:\/\/[^\s]+\/api\/storefront\/pdf\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const URL_IN_TEXT_REGEX = /https?:\/\/[^\s<>"']+/gi;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export function isStorefrontPdfUrl(url: string): boolean {
  return url.toLowerCase().includes("api/storefront/pdf");
}

export function extractStorefrontPdfUrlFromText(text: string): string | null {
  const strictMatch = text.match(EKATALOX_PDF_URL_REGEX);
  if (strictMatch?.[0]) {
    return strictMatch[0];
  }

  const urls = text.match(URL_IN_TEXT_REGEX) ?? [];
  for (const raw of urls) {
    const url = raw.replace(/[.,;:!?)]+$/, "");
    if (isStorefrontPdfUrl(url)) {
      return url;
    }
  }

  return null;
}

/** @deprecated Use extractStorefrontPdfUrlFromText */
export function extractPdfUrlFromText(text: string): string | null {
  return extractStorefrontPdfUrlFromText(text);
}

export async function downloadPdfBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new AppError(
        `PDF indirilemedi (${response.status})`,
        "PDF_FETCH_FAILED",
      );
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PDF_BYTES) {
      throw new AppError("PDF dosyası çok büyük", "PDF_TOO_LARGE");
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
      throw new AppError("PDF dosyası çok büyük", "PDF_TOO_LARGE");
    }
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? "";
    if (!text) {
      throw new AppError(
        "PDF metin içermiyor veya okunamadı",
        "PDF_EMPTY_TEXT",
      );
    }
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, "pdf-parse failed");
    throw new AppError("PDF parse hatası", "PDF_PARSE_ERROR");
  }
}

export async function getPdfTextFromUrl(url: string): Promise<string> {
  if (!isStorefrontPdfUrl(url)) {
    throw new AppError(
      "Geçersiz PDF linki. eKatalox api/storefront/pdf URL'si bekleniyor.",
      "PDF_INVALID_URL",
    );
  }
  const buffer = await downloadPdfBuffer(url);
  return extractTextFromPdfBuffer(buffer);
}

export async function getPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  return extractTextFromPdfBuffer(buffer);
}
