import type { Receipt } from "../schemas/receipt.js";
import type { RuleFailure } from "../types.js";

const TOLERANCE = 0.01;

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function checkReceiptRules(data: Receipt): RuleFailure[] {
  const failures: RuleFailure[] = [];

  const lineSum = data.line_items.reduce(
    (sum, item) => sum + item.qty * item.unit_price,
    0,
  );
  const expected = lineSum + data.tax;
  if (Math.abs(expected - data.total) > TOLERANCE) {
    failures.push({
      field: "total",
      message: `total ${data.total} does not equal line sum ${lineSum.toFixed(2)} + tax ${data.tax} (expected ${expected.toFixed(2)})`,
    });
  }

  const date = parseIsoDate(data.date);
  if (!date) {
    failures.push({
      field: "date",
      message: `date "${data.date}" is not a plausible ISO date YYYY-MM-DD`,
    });
  } else {
    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    if (date.getTime() > todayUtc) {
      failures.push({
        field: "date",
        message: `date "${data.date}" is in the future`,
      });
    }
  }

  return failures;
}
