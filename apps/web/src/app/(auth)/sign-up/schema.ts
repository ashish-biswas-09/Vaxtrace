import { z } from "zod";

export const signUpSchema = z.object({
  fullName: z.string().min(1, "নাম আবশ্যক").max(120, "নাম অনেক বড়"),
  email: z.string().email("সঠিক ইমেইল দিন"),
  password: z.string().min(8, "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে"),
});
export type SignUpInput = z.infer<typeof signUpSchema>;
