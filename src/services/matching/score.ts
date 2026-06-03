import { normalizeMatchText } from "./normalize.js";
import { getEnv } from "../../config/env.js";

/** Otomatik eşleştirme eşiği (0-100). Env: FUZZY_MATCH_THRESHOLD, default 70. */
export function getAutoMatchThreshold(): number {
  return getEnv().FUZZY_MATCH_THRESHOLD;
}

/** Öneri gösterimi eşiği — otomatik eşiğin 20 puan altı. */
export function getSuggestionThreshold(): number {
  return Math.max(30, getAutoMatchThreshold() - 20);
}

/** @deprecated Use getAutoMatchThreshold() */
export const AUTO_MATCH_THRESHOLD = 70;

/** @deprecated Use getSuggestionThreshold() */
export const SUGGESTION_THRESHOLD = 50;

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-_./\\]/g, "");
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

function tokenize(text: string): string[] {
  return normalizeMatchText(text)
    .split(" ")
    .filter((t) => t.length >= 2);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

/** İki ünvan/isim arasında 0-100 skor. */
export function scoreNameMatch(a: string, b: string): number {
  const na = normalizeMatchText(a);
  const nb = normalizeMatchText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    return Math.min(95, 70 + Math.round((shorter / longer) * 25));
  }

  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const overlap = tokensA.filter((t) => setB.has(t)).length;
  const tokenScore = Math.round(
    (overlap / Math.max(tokensA.length, tokensB.length)) * 80,
  );

  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  const levScore = Math.max(0, Math.round((1 - dist / maxLen) * 60));

  return Math.max(tokenScore, levScore);
}

export function scoreCodeMatch(a: string, b: string): number {
  const ca = normalizeCode(a);
  const cb = normalizeCode(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 100;
  if (ca.includes(cb) || cb.includes(ca)) return 85;
  return 0;
}

export interface ScoredCandidate<T> {
  item: T;
  score: number;
  reason: string;
}

export function pickBestCandidate<T>(
  candidates: ScoredCandidate<T>[],
): ScoredCandidate<T> | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cur) => (cur.score > best.score ? cur : best));
}
