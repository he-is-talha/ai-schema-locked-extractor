import { z } from "zod";

export const employmentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "contract",
  "internship",
]);

export const jobPostingSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  employment_type: employmentTypeSchema,
  salary_min: z.number().nonnegative().nullable(),
  salary_max: z.number().nonnegative().nullable(),
  requirements: z.array(z.string().min(1)),
});

export type JobPosting = z.infer<typeof jobPostingSchema>;

export const jobPostingJsonSchema = z.toJSONSchema(jobPostingSchema);
