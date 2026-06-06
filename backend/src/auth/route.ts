import { Router } from "express";
import { authUpload } from "./upload";
import { forgotPassword, login, refreshTokenController, resetPassword, revokeToken, signup, getMe } from "./controller";
import { isAuthenticated } from "../middleware";

const router = Router();

router.post("/signup", authUpload.single("image"), signup);
router.post("/login", login);
router.post("/refresh", refreshTokenController);
router.post("/revoke-token", revokeToken);
router.post("/logout", revokeToken); // alias for logout
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", isAuthenticated, getMe);

export default router;
