import { z } from "zod";

export const meetingNotesSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1).describe("ISO date YYYY-MM-DD"),
  attendees: z.array(z.string().min(1)).min(1),
  decisions: z.array(z.string()),
  action_items: z.array(
    z.object({
      owner: z.string().min(1),
      task: z.string().min(1),
      due_date: z.string().nullable().describe("ISO date YYYY-MM-DD or null"),
    }),
  ),
});

export type MeetingNotes = z.infer<typeof meetingNotesSchema>;

export const meetingNotesJsonSchema = z.toJSONSchema(meetingNotesSchema);
