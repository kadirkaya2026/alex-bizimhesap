import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMappingWarnings,
  formatSourceLabel,
} from "./smart-mapping.js";

describe("formatSourceLabel", () => {
  it("shows fuzzy score for catalog matches", () => {
    assert.equal(formatSourceLabel("catalog", 82), "fuzzy (%82)");
  });

  it("shows varsayılan for fallback", () => {
    assert.equal(formatSourceLabel("fallback"), "varsayılan");
  });
});

describe("buildMappingWarnings", () => {
  it("warns when fallback customer assigned", () => {
    const warnings = buildMappingWarnings(
      {
        customerId: "C-FALLBACK",
        title: "Kadir Kaya Ltd.",
        bizimhesapTitle: "WhatsApp Gelen Fişleri",
        source: "fallback",
      },
      [],
    );
    assert.ok(warnings.some((w) => w.type === "customer"));
  });

  it("warns when fallback product assigned", () => {
    const warnings = buildMappingWarnings(
      {
        customerId: "C1",
        title: "Test",
        source: "catalog",
      },
      [
        {
          index: 0,
          qty: 1,
          name: "Lucatech LA-031 Ultrasonik",
          productId: "P-FALLBACK",
          bizimhesapTitle: "Tanımsız WhatsApp Ürünü",
          source: "fallback",
        },
      ],
    );
    assert.ok(warnings.some((w) => w.type === "product" && w.lineIndex === 0));
  });
});
