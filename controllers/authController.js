const User = require("../models/User");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");

// Helper functions
const createAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

// Updated register function
exports.register = async (req, res, next) => {
  const { username, email, password } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res.status(400).json({
      status: "error",
      message: "Email or username already in use",
    });
  }

  // Create new user
  const newUser = await User.create({ username, email, password });

  // Generate tokens
  const accessToken = createAccessToken(newUser._id);
  const refreshToken = createRefreshToken(newUser._id);

  // Save refresh token to database
  newUser.refreshToken = refreshToken;
  await newUser.save({ validateBeforeSave: false });

  // Send response
  res.status(201).json({
    status: "success",
    accessToken,
    refreshToken,
    data: {
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        avatar: newUser.avatar,
      },
    },
  });
};

const catchAsync = require('../utils/catchAsync');

// Updated login function
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check credentials
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  // 2) Verify user
  const user = await User.findOne({ email }).select(
    "+password +refreshToken"
  );
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 3) Generate new tokens
  const accessToken = createAccessToken(user._id);
  const refreshToken = createRefreshToken(user._id);

  // 4) Save refresh token to DB
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // 5) Send response
  res.status(200).json({
    status: "success",
    accessToken,
    refreshToken,
    data: {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
    },
  });
});

// New refresh token function
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 400));
    }

    // 1) Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // 2) Find user with this token
    const user = await User.findOne({
      _id: decoded.id,
      refreshToken,
    });

    if (!user) {
      return next(new AppError("Invalid refresh token", 403));
    }

    // 3) Generate new access token
    const newAccessToken = createAccessToken(user._id);

    res.status(200).json({
      status: "success",
      accessToken: newAccessToken,
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Refresh token has expired", 401));
    }
    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Invalid refresh token", 401));
    }
    next(err);
  }
};

// Updated logout function
exports.logout = catchAsync(async (req, res, next) => {
  // Remove refresh token from database
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } },
    { new: true }
  );

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
});

// Get current user
exports.getMe = catchAsync(async (req, res, next) => {
  // req.user is already set by the protect middleware
  res.status(200).json({
    status: "success",
    data: {
      user: req.user,
    },
  });
});

// authController.js
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return next(new AppError("No token provided", 401));
  }

  // 2) Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 3) Check user exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError("User not found", 401));
  }

  // 4) Attach user to request
  req.user = user;
  next();
});
