import { describe, expect, it } from "vitest";
import { checkReceiptRules } from "./receipt.js";
import { checkJobPostingRules } from "./job-posting.js";
import { checkMeetingNotesRules } from "./meeting-notes.js";

describe("receipt rules", () => {
  it("passes when totals add up", () => {
    expect(
      checkReceiptRules({
        vendor: "X",
        date: "2025-01-01",
        line_items: [
          { desc: "a", qty: 2, unit_price: 4.5 },
          { desc: "b", qty: 1, unit_price: 3.25 },
        ],
        tax: 1.1,
        total: 13.35,
      }),
    ).toEqual([]);
  });

  it("fails when total mismatches", () => {
    const failures = checkReceiptRules({
      vendor: "X",
      date: "2025-01-01",
      line_items: [{ desc: "a", qty: 1, unit_price: 10 }],
      tax: 1,
      total: 99,
    });
    expect(failures[0]?.field).toBe("total");
  });

  it("fails on future date", () => {
    const failures = checkReceiptRules({
      vendor: "X",
      date: "2099-01-01",
      line_items: [{ desc: "a", qty: 1, unit_price: 1 }],
      tax: 0,
      total: 1,
    });
    expect(failures.some((f) => f.field === "date")).toBe(true);
  });
});

describe("job posting rules", () => {
  it("fails when min > max", () => {
    const failures = checkJobPostingRules({
      title: "E",
      company: "C",
      location: "L",
      employment_type: "full_time",
      salary_min: 200000,
      salary_max: 180000,
      requirements: [],
    });
    expect(failures[0]?.field).toBe("salary_min");
  });

  it("allows null salaries", () => {
    expect(
      checkJobPostingRules({
        title: "E",
        company: "C",
        location: "L",
        employment_type: "contract",
        salary_min: null,
        salary_max: null,
        requirements: ["Go"],
      }),
    ).toEqual([]);
  });
});

describe("meeting notes rules", () => {
  it("fails when due_date is before meeting", () => {
    const failures = checkMeetingNotesRules({
      title: "Sync",
      date: "2025-09-10",
      attendees: ["Ava"],
      decisions: [],
      action_items: [
        { owner: "Ava", task: "email", due_date: "2025-09-01" },
      ],
    });
    expect(failures[0]?.field).toContain("due_date");
  });
});
