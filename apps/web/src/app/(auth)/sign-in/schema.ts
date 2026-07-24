import { z } from "zod";

export const passwordSignInSchema = z.object({
  email: z.string().email("সঠিক ইমেইল দিন"),
  password: z.string().min(1, "পাসওয়ার্ড আবশ্যক"),
});
export type PasswordSignInInput = z.infer<typeof passwordSignInSchema>;

export const otpRequestSchema = z.object({
  phone: z.string().regex(/^\+8801[3-9]\d{8}$/, "সঠিক মোবাইল নম্বর দিন (+8801XXXXXXXXX)"),
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
