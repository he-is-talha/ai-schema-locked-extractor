import type { MeetingNotes } from "../schemas/meeting-notes.js";
import type { RuleFailure } from "../types.js";

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function checkMeetingNotesRules(data: MeetingNotes): RuleFailure[] {
  const failures: RuleFailure[] = [];

  if (data.attendees.length < 1) {
    failures.push({
      field: "attendees",
      message: "at least one attendee is required",
    });
  }

  const meetingDate = parseIsoDate(data.date);
  if (!meetingDate) {
    failures.push({
      field: "date",
      message: `date "${data.date}" is not a plausible ISO date YYYY-MM-DD`,
    });
    return failures;
  }

  data.action_items.forEach((item, index) => {
    if (item.due_date === null) return;
    const due = parseIsoDate(item.due_date);
    if (!due) {
      failures.push({
        field: `action_items[${index}].due_date`,
        message: `due_date "${item.due_date}" is not a plausible ISO date`,
      });
      return;
    }
    if (due.getTime() < meetingDate.getTime()) {
      failures.push({
        field: `action_items[${index}].due_date`,
        message: `due_date "${item.due_date}" is before meeting date "${data.date}"`,
      });
    }
  });

  return failures;
}
