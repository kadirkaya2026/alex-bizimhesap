import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrderDraftLine } from "./order-draft.schema.js";
import {
  extractPricesFromPdfText,
  repairLinePricesFromPdfText,
} from "./repair-prices.js";

const lucatechPdf = `
Lucatech LB-1002 Taşınabilir Hoparlör  2  8.95 $  17.90 $
Lucatech LA-031 Ultrasonik  1  1.55 $  1.55 $
Lucatech LU-004 Flash Disk  1  3.25 $  3.25 $
`;

describe("extractPricesFromPdfText", () => {
  it("reads unit price 8.95 for LB-1002", () => {
    const line: OrderDraftLine = {
      name: "Lucatech LB-1002 Taşınabilir Hoparlör",
      qty: 1,
      unitPrice: 17.9,
    };
    const { unitPrice, lineTotal } = extractPricesFromPdfText(lucatechPdf, line);
    assert.equal(unitPrice, 8.95);
    assert.equal(lineTotal, 17.9);
  });

  it("reads unit price 1.55 for LA-031", () => {
    const line: OrderDraftLine = {
      name: "Lucatech LA-031 Ultrasonik",
      qty: 1,
      unitPrice: 9.99,
    };
    const { unitPrice } = extractPricesFromPdfText(lucatechPdf, line);
    assert.equal(unitPrice, 1.55);
  });
});

describe("repairLinePricesFromPdfText", () => {
  it("fixes wrong GPT unit price from PDF", () => {
    const draft = {
      customerName: "Lucatech",
      currency: "USD" as const,
      lines: [
        {
          name: "Lucatech LB-1002 Taşınabilir Hoparlör",
          qty: 1,
          unitPrice: 17.9,
        },
        {
          name: "Lucatech LA-031 Ultrasonik",
          qty: 1,
          unitPrice: 1.55,
        },
      ],
      source: "pdf_text" as const,
    };

    const repaired = repairLinePricesFromPdfText(lucatechPdf, draft);
    assert.equal(repaired.lines[0]?.unitPrice, 8.95);
    assert.equal(repaired.lines[1]?.unitPrice, 1.55);
  });
});
