import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogCache } from "./catalog.js";
import { sanitizeCustomerId, sanitizeProductId } from "./validate-catalog-id.js";

function mockCache(products: { id: string; title: string }[]): CatalogCache {
  return {
    findProductById: async (id: string) => {
      const p = products.find((x) => x.id === id);
      if (!p) return null;
      return { id: p.id, title: p.title, codes: [p.title] };
    },
  } as unknown as CatalogCache;
}

describe("sanitizeProductId", () => {
  it("keeps productId when it exists in live catalog", async () => {
    const cache = mockCache([{ id: "REAL-ID-1", title: "LB-1002" }]);
    const result = await sanitizeProductId(
      {
        productId: "REAL-ID-1",
        name: "Lucatech LB-1002 Hoparlör",
        bizimhesapTitle: "LB-1002",
        source: "catalog",
        matchScore: 85,
      },
      cache,
    );
    assert.equal(result.productId, "REAL-ID-1");
    assert.equal(result.bizimhesapTitle, "LB-1002");
    assert.equal(result.source, "catalog");
  });

  it("strips stale/unknown productId so fallback can apply", async () => {
    const cache = mockCache([{ id: "REAL-ID-1", title: "LB-1002" }]);
    const result = await sanitizeProductId(
      {
        productId: "88B29F67812648A7B15292E25CD391F7",
        name: "Lucatech LB-1002 Hoparlör",
        bizimhesapTitle: "LB-1002",
        source: "db",
      },
      cache,
    );
    assert.equal(result.productId, undefined);
    assert.equal(result.source, "none");
  });

  it("strips productId when catalog unavailable so fallback applies", async () => {
    const result = await sanitizeProductId(
      {
        productId: "SOME-ID",
        name: "Test",
        source: "db",
      },
      undefined,
    );
    assert.equal(result.productId, undefined);
    assert.equal(result.source, "none");
  });

  it("strips customerId when catalog unavailable so fallback applies", async () => {
    const result = await sanitizeCustomerId(
      {
        customerId: "C-SOME",
        title: "Test Cari",
        source: "db",
      },
      undefined,
    );
    assert.equal(result.customerId, undefined);
    assert.equal(result.source, "none");
  });
});
