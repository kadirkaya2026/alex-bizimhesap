import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeCustomerRecord,
  normalizeProductRecord,
} from "./catalog.js";
import { extractLineCodeCandidates, lineContainsProductCode } from "./extract-codes.js";
import { parseMappingCommand } from "./mapping-commands.js";
import { normalizeMatchText } from "./normalize.js";
import {
  normalizeCode,
  scoreCodeMatch,
  scoreNameMatch,
} from "./score.js";

describe("normalizeMatchText", () => {
  it("lowercases and trims Turkish text", () => {
    assert.equal(normalizeMatchText("  ABC Ltd. Şti.  "), "abc");
  });
});

describe("scoreNameMatch", () => {
  it("scores partial customer name overlap high", () => {
    const score = scoreNameMatch("ABC Ticaret", "ABC Ticaret Ltd. Şti.");
    assert.ok(score >= 75);
  });

  it("exact match is 100", () => {
    assert.equal(scoreNameMatch("Test Ürün", "Test Ürün"), 100);
  });
});

describe("scoreCodeMatch", () => {
  it("matches normalized codes", () => {
    assert.equal(scoreCodeMatch("MODEL-123", "model123"), 100);
  });
});

describe("normalizeCode", () => {
  it("strips separators", () => {
    assert.equal(normalizeCode("AB-12.34"), "AB1234");
  });
});

describe("extractLineCodeCandidates", () => {
  it("extracts parenthetical code", () => {
    const codes = extractLineCodeCandidates({
      name: "Kalem Seti (MODEL-99)",
      qty: 1,
      unitPrice: 10,
    });
    assert.ok(codes.includes("MODEL-99"));
  });

  it("extracts embedded model code from long product name", () => {
    const codes = extractLineCodeCandidates({
      name: "Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici",
      qty: 1,
      unitPrice: 10,
    });
    assert.ok(codes.includes("LA-031"));
  });
});

describe("lineContainsProductCode", () => {
  it("matches Bizimhesap title code inside PDF line name", () => {
    assert.equal(
      lineContainsProductCode(
        "Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici",
        "LA-031",
      ),
      true,
    );
  });
});

describe("parseMappingCommand", () => {
  it("parses CARI command", () => {
    assert.deepEqual(parseMappingCommand("CARI:6761"), {
      type: "cari",
      value: "6761",
    });
  });

  it("parses SKU2 command", () => {
    assert.deepEqual(parseMappingCommand("SKU2:ABC123"), {
      type: "sku",
      lineIndex: 1,
      value: "ABC123",
    });
  });

  it("parses YENIDEN", () => {
    assert.deepEqual(parseMappingCommand("YENIDEN"), { type: "yeniden" });
  });
});

describe("normalizeCustomerRecord", () => {
  it("extracts id and title", () => {
    const result = normalizeCustomerRecord({
      customerId: "123",
      title: "Deneme A.Ş.",
      taxNo: "1234567890",
    });
    assert.deepEqual(result, {
      id: "123",
      title: "Deneme A.Ş.",
      taxNo: "1234567890",
      phone: undefined,
    });
  });
});

describe("normalizeProductRecord", () => {
  it("collects multiple codes", () => {
    const result = normalizeProductRecord({
      productId: "99",
      name: "Kalem",
      barcode: "8690123456789",
      stokKodu: "MODEL-X",
    });
    assert.ok(result?.codes.includes("8690123456789"));
    assert.ok(result?.codes.includes("MODEL-X"));
    assert.ok(result?.codes.includes("99"));
  });
});
