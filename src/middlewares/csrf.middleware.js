import { errorResponse } from "../utils/response.js";

export const csrfProtect = (req, res, next) => {
  const cookieToken = req.cookies.csrfToken;
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return errorResponse(res, 403, "Invalid CSRF token");
  }
  next();
};
