import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogCache } from "./catalog.js";
import { isDbMappingValidForLine } from "./product.js";
import type { OrderDraftLine } from "../parser/order-draft.schema.js";

function mockCatalog(products: {
  id: string;
  title: string;
  codes: string[];
}[]): CatalogCache {
  return {
    findProductById: async (id: string) => {
      const p = products.find((x) => x.id === id);
      if (!p) return null;
      return { id: p.id, title: p.title, codes: p.codes };
    },
  } as unknown as CatalogCache;
}

describe("isDbMappingValidForLine", () => {
  const line: OrderDraftLine = {
    name: "Lucatech LB-1002 Taşınabilir Hoparlör",
    qty: 2,
    unitPrice: 8.95,
  };

  it("accepts DB mapping when product code matches", async () => {
    const cache = mockCatalog([
      { id: "REAL-LB", title: "LB-1002", codes: ["LB-1002", "REAL-LB"] },
    ]);
    assert.equal(await isDbMappingValidForLine(cache, "REAL-LB", line), true);
  });

  it("rejects stale DB mapping with unrelated product", async () => {
    const cache = mockCatalog([
      {
        id: "88B29F67812648A7B15292E25CD391F7",
        title: "Random Product",
        codes: ["88B29F67812648A7B15292E25CD391F7"],
      },
    ]);
    assert.equal(
      await isDbMappingValidForLine(
        cache,
        "88B29F67812648A7B15292E25CD391F7",
        line,
      ),
      false,
    );
  });
});
