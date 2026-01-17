import { verifyAccessToken } from "../utils/jwt.js";

/**
 * Middleware to authenticate user using JWT Access Token.
 * Extracted from Authorization header (Bearer token).
 * Attaches user ID to req.user for downstream middleware.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Access token required.",
      });
    }

    const token = authHeader.split(" ")[1];
    
    try {
      const decoded = verifyAccessToken(token);
      
      // Attach minimal user info to request
      // decoded.sub is the userId based on src/utils/jwt.js
      req.user = { 
        _id: decoded.sub,
        // Add other claims if your token has them
      };

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Invalid or expired token.",
      });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error during authentication.",
    });
  }
};
