import { describe, expect, it, vi } from "vitest";
import {
  buildRepairPrompt,
  buildSystemPrompt,
  extract,
  formatZodError,
  MAX_TOTAL_ATTEMPTS,
} from "./extract.js";
import type { LlmProvider } from "./provider/index.js";
import { receiptSchema } from "./schemas/receipt.js";
import { z } from "zod";

describe("prompt builders", () => {
  it("system prompt names the document label", () => {
    expect(buildSystemPrompt("receipt")).toContain("receipt");
  });

  it("repair prompt injects validator error text", () => {
    const prompt = buildRepairPrompt(
      "raw text",
      '{"vendor":1}',
      "vendor: Expected string",
    );
    expect(prompt).toContain("vendor: Expected string");
    expect(prompt).toContain('{"vendor":1}');
    expect(prompt).not.toMatch(/try again/i);
  });
});

describe("formatZodError", () => {
  it("includes field path", () => {
    const result = receiptSchema.safeParse({
      vendor: "",
      date: "2025-01-01",
      line_items: [{ desc: "x", qty: 1, unit_price: 1 }],
      tax: 0,
      total: 1,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const formatted = formatZodError(result.error);
    expect(formatted.field).toBe("vendor");
    expect(formatted.message).toContain("vendor");
  });
});

function mockProvider(responses: string[]): LlmProvider {
  let i = 0;
  return {
    name: "mock",
    healthCheck: async () => undefined,
    chat: vi.fn(async () => {
      const next = responses[i] ?? responses[responses.length - 1]!;
      i += 1;
      return next;
    }),
  };
}

describe("extract repair loop", () => {
  it("repairs after a schema failure then succeeds", async () => {
    const bad = JSON.stringify({
      vendor: 123,
      date: "2025-01-01",
      line_items: [{ desc: "tea", qty: 1, unit_price: 3 }],
      tax: 0,
      total: 3,
    });
    const good = JSON.stringify({
      vendor: "Cafe",
      date: "2025-01-01",
      line_items: [{ desc: "tea", qty: 1, unit_price: 3 }],
      tax: 0,
      total: 3,
    });
    const provider = mockProvider([bad, good]);
    const result = await extract({
      type: "receipt",
      text: "tea 3 dollars at Cafe on 2025-01-01",
      provider,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });

  it("stops after max attempts on persistent decode failure", async () => {
    const provider = mockProvider(["not-json", "still-not", "nope"]);
    const result = await extract({
      type: "receipt",
      text: "garbage",
      provider,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.layer).toBe("decode");
    expect(result.attempts).toBe(MAX_TOTAL_ATTEMPTS);
    expect(provider.chat).toHaveBeenCalledTimes(MAX_TOTAL_ATTEMPTS);
  });

  it("does not repair business_rule failures", async () => {
    const schemaOkBadTotal = JSON.stringify({
      vendor: "Joe",
      date: "2025-04-20",
      line_items: [
        { desc: "hammer", qty: 1, unit_price: 12.99 },
        { desc: "nails", qty: 1, unit_price: 5.49 },
      ],
      tax: 1.48,
      total: 25,
    });
    const provider = mockProvider([schemaOkBadTotal]);
    const result = await extract({
      type: "receipt",
      text: "broken total",
      provider,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.layer).toBe("business_rule");
    expect(result.attempts).toBe(1);
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });
});

describe("zod 4 toJSONSchema", () => {
  it("is available on z", () => {
    expect(typeof z.toJSONSchema).toBe("function");
    const schema = z.toJSONSchema(z.object({ a: z.string() }));
    expect(schema).toMatchObject({ type: "object" });
  });
});
