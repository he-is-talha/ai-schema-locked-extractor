import { describe, expect, it } from "vitest";
import { receiptSchema, receiptJsonSchema } from "./receipt.js";
import { jobPostingSchema, jobPostingJsonSchema } from "./job-posting.js";
import {
  meetingNotesSchema,
  meetingNotesJsonSchema,
} from "./meeting-notes.js";
import { getSchema, isDocumentType } from "./index.js";

describe("receipt schema", () => {
  it("accepts a valid receipt", () => {
    const result = receiptSchema.safeParse({
      vendor: "Cafe",
      date: "2025-01-01",
      line_items: [{ desc: "tea", qty: 1, unit_price: 3 }],
      tax: 0.3,
      total: 3.3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty vendor", () => {
    const result = receiptSchema.safeParse({
      vendor: "",
      date: "2025-01-01",
      line_items: [{ desc: "tea", qty: 1, unit_price: 3 }],
      tax: 0,
      total: 3,
    });
    expect(result.success).toBe(false);
  });

  it("exports JSON Schema with required properties", () => {
    const schema = receiptJsonSchema as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("vendor");
    expect(schema.properties).toHaveProperty("line_items");
    expect(schema.required).toEqual(
      expect.arrayContaining(["vendor", "date", "line_items", "tax", "total"]),
    );
  });
});

describe("job_posting schema", () => {
  it("rejects unknown employment_type", () => {
    const result = jobPostingSchema.safeParse({
      title: "Eng",
      company: "Co",
      location: "Remote",
      employment_type: "gig",
      salary_min: null,
      salary_max: null,
      requirements: ["TS"],
    });
    expect(result.success).toBe(false);
  });

  it("exports employment_type enum in JSON Schema", () => {
    const schema = jobPostingJsonSchema as {
      properties?: {
        employment_type?: { enum?: string[] };
      };
    };
    expect(schema.properties?.employment_type?.enum).toEqual(
      expect.arrayContaining(["full_time", "part_time", "contract", "internship"]),
    );
  });
});

describe("meeting_notes schema", () => {
  it("requires at least one attendee at schema level", () => {
    const result = meetingNotesSchema.safeParse({
      title: "Sync",
      date: "2025-01-01",
      attendees: [],
      decisions: [],
      action_items: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("registry", () => {
  it("resolves all document types", () => {
    for (const type of ["receipt", "job_posting", "meeting_notes"] as const) {
      expect(isDocumentType(type)).toBe(true);
      const entry = getSchema(type);
      expect(entry.zod.safeParse).toBeTypeOf("function");
      expect(entry.jsonSchema).toBeTypeOf("object");
    }
  });
});
