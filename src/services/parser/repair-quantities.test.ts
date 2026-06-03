import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrderDraftLine } from "./order-draft.schema.js";
import {
  extractQtyFromPdfText,
  repairLineQuantitiesFromPdfText,
} from "./repair-quantities.js";

const lucatechPdf = `
Lucatech - Kaliteyi Keşfet
Ürün Adı                    Adet  Birim Fiyat  Toplam
Lucatech LB-1002 Taşınabilir Hoparlör  2  8.95 $  17.90 $
Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici  1  1.55 $  1.55 $
Lucatech LU-004 64GB USB 3.0 Flash Disk  1  3.25 $  3.25 $
Toplam: 22.70 $
`;

describe("extractQtyFromPdfText", () => {
  it("reads qty 2 from eKatalox table row for LB-1002", () => {
    const line: OrderDraftLine = {
      name: "Lucatech LB-1002 Taşınabilir Hoparlör",
      qty: 1,
      unitPrice: 8.95,
    };
    assert.equal(extractQtyFromPdfText(lucatechPdf, line), 2);
  });

  it("keeps qty 1 when table shows 1", () => {
    const line: OrderDraftLine = {
      name: "Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici",
      qty: 1,
      unitPrice: 1.55,
    };
    assert.equal(extractQtyFromPdfText(lucatechPdf, line), 1);
  });

  it("parses x2 pattern", () => {
    const pdf = "Lucatech LB-1002 Hoparlör x2 8.95 $ 17.90 $";
    const line: OrderDraftLine = {
      name: "Lucatech LB-1002 Hoparlör",
      qty: 1,
      unitPrice: 8.95,
    };
    assert.equal(extractQtyFromPdfText(pdf, line), 2);
  });

  it("parses 2x pattern", () => {
    const pdf = "Lucatech LB-1002 Hoparlör 2x 8.95 $ 17.90 $";
    const line: OrderDraftLine = {
      name: "Lucatech LB-1002 Hoparlör",
      qty: 1,
      unitPrice: 8.95,
    };
    assert.equal(extractQtyFromPdfText(pdf, line), 2);
  });

  it("parses 2.00 quantity", () => {
    const pdf = "Lucatech LB-1002 Hoparlör 2.00 8.95 $ 17.90 $";
    const line: OrderDraftLine = {
      name: "Lucatech LB-1002 Hoparlör",
      qty: 1,
      unitPrice: 8.95,
    };
    assert.equal(extractQtyFromPdfText(pdf, line), 2);
  });

  it("parses 2 adet pattern", () => {
    const pdf = "Lucatech LB-1002 Hoparlör 2 adet 8.95 $ 17.90 $";
    const line: OrderDraftLine = {
      name: "Lucatech LB-1002 Hoparlör",
      qty: 1,
      unitPrice: 8.95,
    };
    assert.equal(extractQtyFromPdfText(pdf, line), 2);
  });
});

describe("repairLineQuantitiesFromPdfText", () => {
  it("fixes GPT qty=1 to qty=2 when PDF shows 2 adet", () => {
    const draft = {
      customerName: "Lucatech",
      currency: "USD" as const,
      lines: [
        {
          name: "Lucatech LB-1002 Taşınabilir Hoparlör",
          qty: 1,
          unitPrice: 8.95,
        },
        {
          name: "Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici",
          qty: 1,
          unitPrice: 1.55,
        },
      ],
      source: "pdf_text" as const,
    };

    const repaired = repairLineQuantitiesFromPdfText(lucatechPdf, draft);
    assert.equal(repaired.lines[0]?.qty, 2);
    assert.equal(repaired.lines[1]?.qty, 1);
  });

  it("does not downgrade qty from 2 to 1 when PDF evidence is weak", () => {
    const draft = {
      customerName: "Lucatech",
      currency: "USD" as const,
      lines: [
        {
          name: "Lucatech LB-1002 Taşınabilir Hoparlör",
          qty: 2,
          unitPrice: 8.95,
        },
      ],
      source: "pdf_text" as const,
    };
    const pdfWithoutQty = "Lucatech LB-1002 Taşınabilir Hoparlör 8.95 $ 17.90 $";
    const repaired = repairLineQuantitiesFromPdfText(pdfWithoutQty, draft);
    assert.equal(repaired.lines[0]?.qty, 2);
  });
});
