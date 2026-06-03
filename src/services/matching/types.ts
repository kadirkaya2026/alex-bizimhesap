import type { MatchSource } from "./customer.js";

export interface MatchSuggestion {
  id: string;
  label: string;
  score: number;
  reason: string;
  commandHint: string;
}

export interface ManualOverrides {
  customerId?: string;
  productIdsByLine?: Record<number, string>;
}

export interface CustomerSuggestion {
  pdfName: string;
  suggestion: MatchSuggestion;
}

export interface ProductSuggestion {
  lineIndex: number;
  pdfName: string;
  sku?: string;
  suggestion: MatchSuggestion;
}

export interface ResolvedCustomerWithSuggestion {
  customerId?: string;
  title: string;
  source: MatchSource | "manual";
  suggestion?: MatchSuggestion;
}

export interface ResolvedProductLineWithSuggestion {
  productId?: string;
  name: string;
  sku?: string;
  source: MatchSource | "manual";
  suggestion?: MatchSuggestion;
}
