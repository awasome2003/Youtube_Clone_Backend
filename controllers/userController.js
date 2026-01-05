const User = require("../models/User");
const Video = require("../models/Video");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const upload = require("../utils/upload");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Get user profile by ID
exports.getUserProfile = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid user ID", 400));
  }

  const user = await User.findById(id).select("-password -refreshToken");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Get user's video count
  const videoCount = await Video.countDocuments({ userId: id });

  // Format the response
  const profileData = {
    ...user.toObject(),
    videoCount,
    joinDate: user.createdAt,
  };

  res.status(200).json({
    status: "success",
    data: {
      user: profileData,
    },
  });
});

// Get current user profile
exports.getCurrentUserProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Get user's video count
  const videoCount = await Video.countDocuments({ userId: req.user._id });

  // Format the response
  const profileData = {
    ...user.toObject(),
    videoCount,
    joinDate: user.createdAt,
  };

  res.status(200).json({
    status: "success",
    data: {
      user: profileData,
    },
  });
});

// Update user profile
exports.updateUserProfile = catchAsync(async (req, res, next) => {
  const allowedFields = ["username", "email", "description", "channelName", "website"];
  const updatedData = {};

  // Only allow specific fields to be updated and handle empty strings
  Object.keys(req.body).forEach(field => {
    if (allowedFields.includes(field)) {
      // Convert empty strings to undefined for optional fields
      if (req.body[field] === "") {
        return; // Skip empty strings
      }
      updatedData[field] = req.body[field];
    }
  });

  // Check if username or email already exists (if being updated)
  if (updatedData.username) {
    const existingUser = await User.findOne({ 
      username: updatedData.username, 
      _id: { $ne: req.user._id } 
    });
    if (existingUser) {
      return next(new AppError("Username already taken", 400));
    }
  }

  if (updatedData.email) {
    const existingUser = await User.findOne({ 
      email: updatedData.email, 
      _id: { $ne: req.user._id } 
    });
    if (existingUser) {
      return next(new AppError("Email already taken", 400));
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    updatedData,
    {
      new: true,
      runValidators: true,
    }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    return next(new AppError("User not found", 404));
  }

  // Update user in localStorage if needed
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    // We'll handle frontend updates through the response
  }

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

// Update user avatar
exports.updateUserAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No image file uploaded", 400));
  }

  // Process image with sharp
  const filename = `user-${req.user._id}-${Date.now()}.jpeg`;
  const uploadPath = path.join(__dirname, "../uploads/avatars");

  // Ensure directory exists
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(path.join(uploadPath, filename));

  // Update user's avatar field
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: `/uploads/avatars/${filename}` },
    {
      new: true,
      runValidators: true,
    }
  ).select("-password -refreshToken");

  // Clean up temp file
  if (req.file.path) {
    fs.unlinkSync(req.file.path);
  }

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

// Get user's uploaded videos
exports.getUserVideos = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid user ID", 400));
  }

  const videos = await Video.find({ userId: id })
    .populate("userId", "username avatar")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: videos.length,
    data: {
      videos,
    },
  });
});

// Get current user's uploaded videos
exports.getCurrentUserVideos = catchAsync(async (req, res, next) => {
  const videos = await Video.find({ userId: req.user._id })
    .populate("userId", "username avatar")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: videos.length,
    data: {
      videos,
    },
  });
});

// Get user's subscriptions
exports.getUserSubscriptions = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid user ID", 400));
  }

  const user = await User.findById(id).populate("subscribedChannels", "username avatar subscribersCount");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    results: user.subscribedChannels.length,
    data: {
      subscriptions: user.subscribedChannels,
    },
  });
});

// Get current user's subscriptions
exports.getCurrentUserSubscriptions = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate("subscribedChannels", "username avatar subscribersCount");

  res.status(200).json({
    status: "success",
    results: user.subscribedChannels.length,
    data: {
      subscriptions: user.subscribedChannels,
    },
  });
});

// Get user's saved videos
exports.getUserSavedVideos = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid user ID", 400));
  }

  const user = await User.findById(id).populate("savedVideos");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    results: user.savedVideos.length,
    data: {
      savedVideos: user.savedVideos,
    },
  });
});

// Get current user's saved videos
exports.getCurrentUserSavedVideos = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate("savedVideos");

  res.status(200).json({
    status: "success",
    results: user.savedVideos.length,
    data: {
      savedVideos: user.savedVideos,
    },
  });
});

// Upload avatar middleware
exports.uploadAvatar = upload.single("avatar");

// Update video details (for user's own videos)
exports.updateVideo = catchAsync(async (req, res, next) => {
  const { id: videoId } = req.params; // Use 'id' as parameter name to match route

  // Validate video ID format
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return next(new AppError("Invalid video ID", 400));
  }

  // Find the video and ensure it belongs to the current user
  const video = await Video.findOne({ _id: videoId, userId: req.user._id });

  if (!video) {
    return next(new AppError("Video not found or you don't have permission to edit it", 404));
  }

  // Update video details
  const allowedFields = ["title", "description", "tags", "visibility"];
  const updatedData = {};

  Object.keys(req.body).forEach(field => {
    if (allowedFields.includes(field)) {
      updatedData[field] = req.body[field];
    }
  });

  // Process tags if provided
  if (req.body.tags && typeof req.body.tags === "string") {
    updatedData.tags = req.body.tags.split(",").map(tag => tag.trim());
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    updatedData,
    {
      new: true,
      runValidators: true,
    }
  ).populate("userId", "username avatar");

  res.status(200).json({
    status: "success",
    data: {
      video: updatedVideo,
    },
  });
});

// Delete video (for user's own videos)
exports.deleteVideo = catchAsync(async (req, res, next) => {
  const { videoId } = req.params;

  // Validate video ID format
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return next(new AppError("Invalid video ID", 400));
  }

  // Find the video and ensure it belongs to the current user
  const video = await Video.findOneAndDelete({ 
    _id: videoId, 
    userId: req.user._id 
  });

  if (!video) {
    return next(new AppError("Video not found or you don't have permission to delete it", 404));
  }

  // Delete associated files
  if (video.videoUrl) {
    const videoPath = path.join(__dirname, "..", video.videoUrl);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
  }

  if (video.thumbnailUrl && !video.thumbnailUrl.includes("default-thumbnail")) {
    const thumbPath = path.join(__dirname, "..", video.thumbnailUrl);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
  }

  res.status(200).json({
    status: "success",
    message: "Video deleted successfully",
  });
});
