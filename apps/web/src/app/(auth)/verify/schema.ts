import { z } from "zod";

export const verifyOtpSchema = z.object({
  phone: z.string().min(1),
  token: z.string().length(6, "৬ সংখ্যার কোড দিন"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const resetPwRequestSchema = z.object({
  email: z.string().email("সঠিক ইমেইল দিন"),
});
export type ResetPwRequestInput = z.infer<typeof resetPwRequestSchema>;
