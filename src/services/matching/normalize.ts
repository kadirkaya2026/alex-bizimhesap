/** Eşleştirme için metin normalizasyonu (Türkçe, boşluk, yaygın ünvan kısaltmaları). */
export function normalizeMatchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/\b(ltd\.?\s*şti\.?|a\.?\s*ş\.?|limited|şirketi)\b/gi, "")
    .replace(/[.,;:\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const val = record[key];
    if (val != null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return undefined;
}

export function pickNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const val = record[key];
    if (val == null || val === "") continue;
    const num = typeof val === "number" ? val : Number.parseFloat(String(val).replace(",", "."));
    if (!Number.isNaN(num)) return num;
  }
  return undefined;
}
