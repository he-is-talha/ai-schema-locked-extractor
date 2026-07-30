import type { JobPosting } from "../schemas/job-posting.js";
import type { RuleFailure } from "../types.js";

export function checkJobPostingRules(data: JobPosting): RuleFailure[] {
  const failures: RuleFailure[] = [];

  if (
    data.salary_min !== null &&
    data.salary_max !== null &&
    data.salary_min > data.salary_max
  ) {
    failures.push({
      field: "salary_min",
      message: `salary_min ${data.salary_min} is greater than salary_max ${data.salary_max}`,
    });
  }

  return failures;
}
