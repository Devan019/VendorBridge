import { configDotenv } from "dotenv";
configDotenv();
const ACCESS_KEY = process.env.ACCESS_KEY;
const REFRESH_KEY = process.env.REFRESH_KEY;
const ACCESS_TOKEN_MAX_AGE_MS = Number(process.env.ACCESS_TOKEN_MAX_AGE_MS ?? 15 * 60 * 1000);
const REFRESH_TOKEN_MAX_AGE_MS = Number(process.env.REFRESH_TOKEN_MAX_AGE_MS ?? 7 * 24 * 60 * 60 * 1000);
const RESET_TOKEN_MAX_AGE_MS = Number(process.env.RESET_TOKEN_MAX_AGE_MS ?? 15 * 60 * 1000);

const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_REGION = process.env.S3_REGION;
const S3_API = process.env.S3_API;
const S3_CDN = process.env.S3_CDN;
const S3_PRIVATE_BUCKET = process.env.S3_PRIVATE_BUCKET;
const S3_PUBLIC_BUCKET = process.env.S3_PUBLIC_BUCKET;

export {
  ACCESS_KEY,
  REFRESH_KEY,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_MAX_AGE_MS,
  RESET_TOKEN_MAX_AGE_MS,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_REGION,
  S3_API,
  S3_CDN,
  S3_PRIVATE_BUCKET,
  S3_PUBLIC_BUCKET,
};