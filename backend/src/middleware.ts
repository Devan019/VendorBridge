import { NextFunction, Request, Response } from "express";
import { formatResponse } from "./utils/formateResponse";
import expressAsyncHandler from "./utils/expressAsync";
import jwt from "jsonwebtoken";
import { ACCESS_KEY } from "./env_var";

export const isAuthenticated = expressAsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { access_token } = req.cookies;

  if (!access_token) {
    return formatResponse(res, 401, "Access token missing", false, null);
  }

  try {
    const decoded = jwt.verify(access_token, ACCESS_KEY ?? "");
    req.user = decoded as any;
    return next();
  } catch (error) {
    return formatResponse(res, 401, "Access token invalid or expired", false, null);
  }
});