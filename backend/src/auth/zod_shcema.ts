import { z } from "zod";
import { UserRole } from "../generated/prisma/enums";

export const signupSchema = z.object({
  first_name: z.string().trim().min(1, "first_name is required"),
  last_name: z.string().trim().min(1, "last_name is required"),
  email: z.string().trim().email("email must be valid"),
  password: z.string().min(8, "password must be at least 8 characters long"),
  role: z.nativeEnum(UserRole).default(UserRole.VENDOR),
  phone: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("email must be valid"),
  password: z.string().min(1, "password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("email must be valid"),
});

export const resetPasswordSchema = z.object({
  reset_token: z.string().trim().min(1, "reset_token is required"),
  password: z.string().min(8, "password must be at least 8 characters long"),
});

export const refreshTokenSchema = z.object({}).optional();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

