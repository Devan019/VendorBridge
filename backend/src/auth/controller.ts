import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "../utils/expressAsync";
import { formatResponse } from "../utils/formateResponse";
import { ACCESS_TOKEN_MAX_AGE_MS } from "../env_var";
import {
  AuthError,
  forgotPassword,
  loginUser,
  refreshAuthToken,
  resetPassword,
  revokeRefreshToken,
  signupUser,
} from "./service";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "./zod_shcema";

function setAuthCookies(res: Response, accessToken: string, refreshTokenValue: string, refreshMaxAgeMs: number) {
  const secure = process.env.NODE_ENV === "production";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  res.cookie("refresh_token", refreshTokenValue, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: refreshMaxAgeMs,
  });
}

function clearAuthCookies(res: Response) {
  const secure = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };

  res.clearCookie("access_token", options);
  res.clearCookie("refresh_token", options);
}

function zodErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    return JSON.stringify((error as { issues: unknown }).issues);
  }

  return "Invalid request payload";
}

export const signup = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = signupSchema.safeParse(req.body);

    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
    }

    const session = await signupService(parsed.data, req.file as Express.Multer.File | undefined);
    setAuthCookies(res, session.access_token, session.refresh_token, session.refresh_max_age_ms);

    req.cookies.access_token = session.access_token;
    req.cookies.refresh_token = session.refresh_token;
    req.user = session.user;

    return formatResponse(res, 201, "Account created successfully", true, {
      user: session.user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return formatResponse(res, error.statusCode, error.message, false, null);
    }

    return next(error);
  }
});

export const login = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
    }

    const session = await loginService(parsed.data);
    setAuthCookies(res, session.access_token, session.refresh_token, session.refresh_max_age_ms);

    req.cookies.access_token = session.access_token;
    req.cookies.refresh_token = session.refresh_token;
    req.user = session.user;

    return formatResponse(res, 200, "Login successful", true, {
      user: session.user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return formatResponse(res, error.statusCode, error.message, false, null);
    }

    return next(error);
  }
});

export const refreshTokenController = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.cookies;

    if (!refresh_token) {
      return formatResponse(res, 401, "Unauthorized", false, null);
    }

    const session = await refreshAuthToken(refresh_token);
    setAuthCookies(res, session.access_token, session.refresh_token, session.refresh_max_age_ms);

    req.cookies.access_token = session.access_token;
    req.cookies.refresh_token = session.refresh_token;
    req.user = session.user;

    return formatResponse(res, 200, "Token refreshed successfully", true, {
      user: session.user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return formatResponse(res, error.statusCode, error.message, false, null);
    }

    return next(error);
  }
});

export const revokeToken = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.cookies;

    if (!refresh_token) {
      clearAuthCookies(res);
      return formatResponse(res, 401, "Unauthorized", false, null);
    }

    await revokeRefreshToken(refresh_token);
    clearAuthCookies(res);

    return formatResponse(res, 200, "Session revoked successfully", true, null);
  } catch (error) {
    clearAuthCookies(res);

    if (error instanceof AuthError) {
      return formatResponse(res, error.statusCode, error.message, false, null);
    }

    return next(error);
  }
});

export const forgotPassword = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
    }

    const result = await forgotPasswordService(parsed.data);
    return formatResponse(res, 200, result.message, true, result);
  } catch (error) {
    if (error instanceof AuthError) {
      return formatResponse(res, error.statusCode, error.message, false, null);
    }

    return next(error);
  }
});

export const resetPassword = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null, zodErrorMessage(parsed.error));
    }

    const result = await resetPasswordService(parsed.data);
    return formatResponse(res, 200, result.message, true, result);
  } catch (error) {
    if (error instanceof AuthError) {
      return formatResponse(res, error.statusCode, error.message, false, null);
    }

    return next(error);
  }
});
