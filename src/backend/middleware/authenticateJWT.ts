import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: number;
  role: "user" | "admin" | "banned";
}

interface AuthRequest extends Request {
  user?: { id: number; role: "user" | "admin" | "banned" };
}

const authenticateJWT = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Get token from Authorization header
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return handleUnauthenticated(req, res);
  }

  try {
    // Verify the token using the secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Set user information from the token
    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    return handleInvalidToken(err, req, res);
  }
};

const handleUnauthenticated = (req: Request, res: Response): void => {
  if (req.accepts("json")) {
    res.status(401).json({
      message: "Authentication required",
      code: "UNAUTHENTICATED",
    });
  } else {
    res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
};

// Handle requests without a valid authentication token
const handleInvalidToken = (
  err: unknown,
  req: Request,
  res: Response
): void => {
  console.error("JWT verification error:", err);

  if (req.accepts("json")) {
    res.status(403).json({
      message: "Invalid token",
      code: "INVALID_TOKEN",
      documentation: "/docs/errors/invalid-token",
    });
  } else {
    res.redirect("/login?invalid_token=true");
  }
};

export default authenticateJWT;
