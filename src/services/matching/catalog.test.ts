import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeCustomerRecord,
  normalizeProductRecord,
} from "./catalog.js";
import { normalizeMatchText } from "./normalize.js";

describe("normalizeMatchText", () => {
  it("lowercases and trims Turkish text", () => {
    assert.equal(normalizeMatchText("  ABC Ltd. Şti.  "), "abc");
  });

  it("collapses whitespace", () => {
    assert.equal(normalizeMatchText("Test   Ürün"), "test ürün");
  });
});

describe("normalizeCustomerRecord", () => {
  it("extracts id and title from flexible fields", () => {
    const result = normalizeCustomerRecord({
      customerId: "123",
      title: "Deneme A.Ş.",
      taxNo: "1234567890",
    });
    assert.deepEqual(result, {
      id: "123",
      title: "Deneme A.Ş.",
      taxNo: "1234567890",
    });
  });

  it("returns null when id missing", () => {
    assert.equal(normalizeCustomerRecord({ title: "X" }), null);
  });
});

describe("normalizeProductRecord", () => {
  it("extracts barcode as sku", () => {
    const result = normalizeProductRecord({
      productId: "99",
      name: "Kalem",
      barcode: "8690123456789",
    });
    assert.deepEqual(result, {
      id: "99",
      title: "Kalem",
      barcode: "8690123456789",
    });
  });
});

describe("customer name matching", () => {
  it("matches normalized titles", () => {
    const a = normalizeMatchText("ABC Ltd. Şti.");
    const b = normalizeMatchText("abc ltd şti");
    assert.equal(a, b);
  });
});
