import { Request, Response } from "express";
import expressAsyncHandler from "../utils/expressAsync";
import { formatResponse } from "../utils/formateResponse";
import { ACCESS_TOKEN_MAX_AGE_MS } from "../env_var";
import prisma from "../utils/prisma";
import {
  forgotPasswordService,
  loginService,
  refreshToken as refreshAuthToken,
  resetPasswordService,
  revokeRefreshToken,
  signupService,
  buildUserPayload,
} from "./service";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "./zod_shcema";

// --- TypeScript Declaration ---
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        first_name: string;
        last_name: string;
        name: string;
        email: string;
        role: string;
        phone?: string | null;
        country?: string | null;
        image_url?: string | null;
      };
    }
  }
}

// --- Cookie Helper Utilities ---
const getCookieOptions = (maxAge?: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  ...(maxAge !== undefined && { maxAge }),
});

function setAuthCookies(res: Response, accessToken: string, refreshTokenValue: string, refreshMaxAgeMs: number) {
  res.cookie("access_token", accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie("refresh_token", refreshTokenValue, getCookieOptions(refreshMaxAgeMs));
}

function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", getCookieOptions());
  res.clearCookie("refresh_token", getCookieOptions());
}

function zodErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    return JSON.stringify((error as { issues: unknown }).issues);
  }
  return "Invalid request payload";
}



// --- Auth Controllers ---

export const signup = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
  }

  const session = await signupService(parsed.data, req.file as Express.Multer.File | undefined);
  setAuthCookies(res, session.access_token, session.refresh_token, session.refresh_max_age_ms);

  return formatResponse(res, 201, "Account created successfully", true, { user: session.user });
});

export const login = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
  }

  const session = await loginService(parsed.data);
  setAuthCookies(res, session.access_token, session.refresh_token, session.refresh_max_age_ms);

  return formatResponse(res, 200, "Login successful", true, { user: session.user });
});

export const refreshTokenController = expressAsyncHandler(async (req: Request, res: Response) => {
  const { refresh_token } = req.cookies;
  if (!refresh_token) {
    return formatResponse(res, 401, "Unauthorized", false, null);
  }

  const session = await refreshAuthToken(refresh_token);
  setAuthCookies(res, session.access_token, session.refresh_token, session.refresh_max_age_ms);

  return formatResponse(res, 200, "Token refreshed successfully", true, { user: session.user });
});

export const revokeToken = expressAsyncHandler(async (req: Request, res: Response) => {
  const { refresh_token } = req.cookies;

  if (refresh_token) {
    // Best-effort: delete from DB. If token is already expired/not found, still log out.
    try {
      await revokeRefreshToken(refresh_token);
    } catch {
      // Token already invalid — still clear cookies and return success
    }
  }

  clearAuthCookies(res);
  return formatResponse(res, 200, "Logged out successfully", true, null);
});

export const forgotPassword = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
  }

  const result = await forgotPasswordService(parsed.data);
  return formatResponse(res, 200, result.message, true, result);
});

export const resetPassword = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
  }

  const result = await resetPasswordService(parsed.data);
  return formatResponse(res, 200, result.message, true, result);
});

export const getMe = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return formatResponse(res, 401, "Unauthorized", false, null);
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    return formatResponse(res, 404, "User not found", false, null);
  }

  const payload = await buildUserPayload(user);
  return formatResponse(res, 200, "User fetched successfully", true, { user: payload });
});