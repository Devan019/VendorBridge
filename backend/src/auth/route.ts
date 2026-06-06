import { Router } from "express";
import { authUpload } from "./upload";
import { forgotPassword, login, refreshTokenController, resetPassword, revokeToken, signup } from "./controller";

const router = Router();

router.post("/signup", authUpload.single("image"), signup);
router.post("/login", login);
router.post("/refresh", refreshTokenController);
router.post("/revoke-token", revokeToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
