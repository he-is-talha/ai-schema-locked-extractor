import type { DocumentType, RuleFailure } from "../types.js";
import { checkReceiptRules } from "../rules/receipt.js";
import { checkJobPostingRules } from "../rules/job-posting.js";
import { checkMeetingNotesRules } from "../rules/meeting-notes.js";
import {
  receiptSchema,
  receiptJsonSchema,
  type Receipt,
} from "./receipt.js";
import {
  jobPostingSchema,
  jobPostingJsonSchema,
  type JobPosting,
} from "./job-posting.js";
import {
  meetingNotesSchema,
  meetingNotesJsonSchema,
  type MeetingNotes,
} from "./meeting-notes.js";
import type { z } from "zod";

export type AnyExtracted = Receipt | JobPosting | MeetingNotes;

export type SchemaEntry<T extends z.ZodType> = {
  zod: T;
  jsonSchema: Record<string, unknown>;
  rules: (data: z.infer<T>) => RuleFailure[];
  label: string;
};

export const documentTypes = [
  "receipt",
  "job_posting",
  "meeting_notes",
] as const satisfies readonly DocumentType[];

export const schemaRegistry = {
  receipt: {
    zod: receiptSchema,
    jsonSchema: receiptJsonSchema as Record<string, unknown>,
    rules: checkReceiptRules,
    label: "receipt",
  },
  job_posting: {
    zod: jobPostingSchema,
    jsonSchema: jobPostingJsonSchema as Record<string, unknown>,
    rules: checkJobPostingRules,
    label: "job posting",
  },
  meeting_notes: {
    zod: meetingNotesSchema,
    jsonSchema: meetingNotesJsonSchema as Record<string, unknown>,
    rules: checkMeetingNotesRules,
    label: "meeting notes",
  },
} as const;

export function getSchema(type: DocumentType) {
  return schemaRegistry[type];
}

export function isDocumentType(value: string): value is DocumentType {
  return (documentTypes as readonly string[]).includes(value);
}

export {
  receiptSchema,
  jobPostingSchema,
  meetingNotesSchema,
  type Receipt,
  type JobPosting,
  type MeetingNotes,
};
