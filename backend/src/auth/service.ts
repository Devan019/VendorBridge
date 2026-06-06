import crypto from "crypto";
import fs from "fs/promises";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";
import { ACCESS_KEY, ACCESS_TOKEN_MAX_AGE_MS, REFRESH_KEY, REFRESH_TOKEN_MAX_AGE_MS, RESET_TOKEN_MAX_AGE_MS, S3_PUBLIC_BUCKET } from "../env_var";
import { uploadBufferToS3, generateSignedUrl } from "../utils/s3";
import { UserRole } from "../generated/prisma/enums";
import type { SignupInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from "./zod_shcema";

export class AuthError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface AuthUserPayload {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  country?: string | null;
  image_url?: string | null;
}

export interface AuthSessionPayload {
  user: AuthUserPayload;
  access_token: string;
  refresh_token: string;
  refresh_expires_at: Date;
  refresh_max_age_ms: number;
}

export interface ResetPasswordResult {
  message: string;
  reset_token?: string;
  expires_at?: Date;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, derivedHash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !derivedHash) {
    return false;
  }

  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(derivedHash, "hex");

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function buildUserPayload(user: {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  country?: string | null;
  image_key?: string | null;
}): Promise<AuthUserPayload> {
  let signedUrl = null;
  if (user.image_key) {
    signedUrl = await generateSignedUrl(user.image_key, S3_PUBLIC_BUCKET || 'public');
  }

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    name: user.name || `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    country: user.country ?? null,
    image_url: signedUrl ?? null,
  };
}

function signAccessToken(user: AuthUserPayload): string {
  return jwt.sign(user, ACCESS_KEY ?? "", {
    expiresIn: Math.max(1, Math.floor(ACCESS_TOKEN_MAX_AGE_MS / 1000)),
  });
}

function signRefreshToken(payload: { id: string; sessionId: string }, maxAgeMs: number): string {
  return jwt.sign(payload, REFRESH_KEY ?? "", {
    expiresIn: Math.max(1, Math.floor(maxAgeMs / 1000)),
  });
}

async function persistRefreshToken(userId: string, sessionId: string, token: string, expiresAt: Date) {
  const tokenHash = hashToken(token);

  await prisma.refreshToken.create({
    data: {
      token: tokenHash,
      session_id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
    },
  });
}

async function uploadProfileImage(buffer: Buffer, mimeType: string): Promise<string> {
  if (!S3_PUBLIC_BUCKET) {
    throw new AuthError(500, "S3_PUBLIC_BUCKET is not configured");
  }

  const uploaded = await uploadBufferToS3({
    prefix: "users/profile-images",
    buffer,
    contentType: mimeType,
    Bucket: S3_PUBLIC_BUCKET,
  });

  if (!uploaded?.Key) {
    throw new AuthError(500, "Unable to upload profile image");
  }

  return uploaded.Key;
}

async function createAuthSession(user: AuthUserPayload, sessionId: string, refreshMaxAgeMs = REFRESH_TOKEN_MAX_AGE_MS): Promise<AuthSessionPayload> {
  const refresh_expires_at = new Date(Date.now() + refreshMaxAgeMs);
  const access_token = signAccessToken(user);
  const refresh_token = signRefreshToken({ id: user.id, sessionId }, refreshMaxAgeMs);

  await persistRefreshToken(user.id, sessionId, refresh_token, refresh_expires_at);

  return {
    user,
    access_token,
    refresh_token,
    refresh_expires_at,
    refresh_max_age_ms: refreshMaxAgeMs,
  };
}

export async function signupService(input: SignupInput, file?: Express.Multer.File): Promise<AuthSessionPayload> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true },
  });

  if (existingUser) {
    throw new AuthError(409, "A user with this email already exists");
  }

  const imageKey = file?.buffer ? await uploadProfileImage(file.buffer, file.mimetype) : null;

  console.log(imageKey)

  try {
    const name = `${input.first_name.trim()} ${input.last_name.trim()}`.trim();
    const user = await prisma.user.create({
      data: {
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        name,
        email: input.email.toLowerCase().trim(),
        password_hash: hashPassword(input.password),
        role: input.role,
        phone: input.phone?.trim() || null,
        country: input.country?.trim() || null,
        image_key: imageKey,

      },
    });

    return createAuthSession(await buildUserPayload(user), crypto.randomUUID());
  } finally {
    // No local files to unlink when using memory storage
  }
}

export async function loginService(input: LoginInput): Promise<AuthSessionPayload> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  if (!user) {
    throw new AuthError(401, "Invalid email or password");
  }

  if (!verifyPassword(input.password, user.password_hash)) {
    throw new AuthError(401, "Invalid email or password");
  }

  return createAuthSession(await buildUserPayload(user), crypto.randomUUID());
}

export async function rotateRefreshToken(refreshToken: string): Promise<AuthSessionPayload> {
  if (!refreshToken) {
    throw new AuthError(401, "Unauthorized");
  }

  let decoded: { id?: string; sessionId?: string };

  try {
    decoded = jwt.verify(refreshToken, REFRESH_KEY ?? "") as { id?: string; sessionId?: string };
  } catch {
    throw new AuthError(401, "Session expired. Please log in again.");
  }

  const { id, sessionId } = decoded;

  if (!id || !sessionId) {
    throw new AuthError(401, "Unauthorized");
  }

  const hashedIncoming = hashToken(refreshToken);

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      user_id: id,
      session_id: sessionId,
    },
  });

  if (!tokenRecord) {
    throw new AuthError(401, "Unauthorized");
  }

  if (tokenRecord.token !== hashedIncoming) {
    await prisma.refreshToken.deleteMany({
      where: {
        user_id: id,
        session_id: sessionId,
      },
    });

    throw new AuthError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new AuthError(404, "User not found");
  }

  const refreshExpiresAt = tokenRecord.expires_at;
  const remainingMs = Math.max(1, refreshExpiresAt.getTime() - Date.now());
  const userPayload = await buildUserPayload(user);

  const access_token = signAccessToken(userPayload);
  const refresh_token = signRefreshToken({ id: user.id, sessionId }, remainingMs);

  tokenRecord.token = hashToken(refresh_token);
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { token: tokenRecord.token },
  });

  return {
    user: userPayload,
    access_token,
    refresh_token,
    refresh_expires_at: refreshExpiresAt,
    refresh_max_age_ms: remainingMs,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) {
    throw new AuthError(401, "Unauthorized");
  }

  let decoded: { id?: string; sessionId?: string };

  try {
    decoded = jwt.verify(refreshToken, REFRESH_KEY ?? "") as { id?: string; sessionId?: string };
  } catch {
    throw new AuthError(401, "Unauthorized");
  }

  if (!decoded.id || !decoded.sessionId) {
    throw new AuthError(401, "Unauthorized");
  }

  const hashedIncoming = hashToken(refreshToken);
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      user_id: decoded.id,
      session_id: decoded.sessionId,
    },
  });

  if (!tokenRecord) {
    throw new AuthError(401, "Unauthorized");
  }

  if (tokenRecord.token !== hashedIncoming) {
    await prisma.refreshToken.deleteMany({
      where: { user_id: decoded.id, session_id: decoded.sessionId },
    });
    throw new AuthError(401, "Unauthorized");
  }

  await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
}

export async function forgotPasswordService(input: ForgotPasswordInput): Promise<ResetPasswordResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    select: { id: true },
  });

  if (!user) {
    throw new AuthError(404, "User not found");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const sessionId = `password-reset:${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MAX_AGE_MS);

  await prisma.refreshToken.create({
    data: {
      token: hashToken(resetToken),
      session_id: sessionId,
      user_id: user.id,
      expires_at: expiresAt,
    },
  });

  return {
    message: "Password reset token created",
    reset_token: resetToken,
    expires_at: expiresAt,
  };
}

export async function resetPasswordService(input: ResetPasswordInput): Promise<{ message: string }> {
  const hashedIncoming = hashToken(input.reset_token);

  const resetRecord = await prisma.refreshToken.findFirst({
    where: {
      token: hashedIncoming,
      session_id: {
        startsWith: "password-reset:",
      },
      expires_at: {
        gt: new Date(),
      },
    },
  });

  if (!resetRecord) {
    throw new AuthError(401, "Reset token is invalid or expired");
  }

  await prisma.user.update({
    where: { id: resetRecord.user_id },
    data: { password_hash: hashPassword(input.password) },
  });

  await prisma.refreshToken.deleteMany({
    where: {
      user_id: resetRecord.user_id,
    },
  });

  return { message: "Password reset successfully" };
}

export const login = loginService;
export const signup = signupService;
export const refreshToken = rotateRefreshToken;
export const revokeToken = revokeRefreshToken;
