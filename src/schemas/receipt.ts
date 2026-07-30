import { z } from "zod";

export const receiptSchema = z.object({
  vendor: z.string().min(1),
  date: z.string().min(1).describe("ISO date YYYY-MM-DD"),
  line_items: z
    .array(
      z.object({
        desc: z.string().min(1),
        qty: z.number().positive(),
        unit_price: z.number().nonnegative(),
      }),
    )
    .min(1),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export type Receipt = z.infer<typeof receiptSchema>;

export const receiptJsonSchema = z.toJSONSchema(receiptSchema);
