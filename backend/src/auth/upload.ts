import multer from "multer";

const authStorage = multer.memoryStorage();

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