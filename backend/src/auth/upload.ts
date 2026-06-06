import fs from "fs";
import path from "path";
import multer from "multer";

const AUTH_UPLOAD_DIR = path.join(process.cwd(), "uploads", "auth");

if (!fs.existsSync(AUTH_UPLOAD_DIR)) {
  fs.mkdirSync(AUTH_UPLOAD_DIR, { recursive: true });
}

const authStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AUTH_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

const authFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (allowed.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error(`File type not allowed: ${file.mimetype}`));
};

export const authUpload = multer({
  storage: authStorage,
  fileFilter: authFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});