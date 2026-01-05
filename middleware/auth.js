const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/appError");

module.exports = async (req, res, next) => {
  try {
    // 1) Get token from header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ error: "Your token has expired! Please log in again." });
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res
        .status(401)
        .json({ error: "The user belonging to this token no longer exists." });
    }

    // 4) Attach user to request and proceed
    req.user = currentUser;
    next();
  } catch (err) {
    // Handle specific JWT errors
    if (err.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ error: "Invalid token. Please log in again!" });
    }
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Invalid token. Please log in again!" });
    }

    // Pass other errors to the global error handler
    next(err);
  }
};
