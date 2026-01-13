const Video = require("../models/Video");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const pipeline = promisify(require("stream").pipeline);
const { exec } = require("child_process");
const NodeCache = require("node-cache");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Notification = require("../models/Notification"); // Add at top with other requires
const ffprobe = promisify(ffmpeg.ffprobe);
const User = require("../models/User");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const PUBLIC_UPLOADS_PATH = path.join(__dirname, "../uploads");
const VIDEOS_PATH = path.join(PUBLIC_UPLOADS_PATH, "videos");
const THUMBNAILS_PATH = path.join(PUBLIC_UPLOADS_PATH, "thumbnails");
// Ensure directories exist
const ensureUploadDirectories = () => {
  [PUBLIC_UPLOADS_PATH, VIDEOS_PATH, THUMBNAILS_PATH].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Cache recommendations for 1 hour
const recoCache = new NodeCache({ stdTTL: 3600 });

// Thumbnail generation function
const generateThumbnail = async (videoPath, outputDir, filename) => {
  try {
    if (!videoPath || !outputDir || !filename) {
      throw new Error("Missing thumbnail parameters");
    }

    const thumbnailPath = path.join(outputDir, filename);

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ["00:00:01"],
          filename,
          folder: outputDir,
        })
        .on("end", resolve)
        .on("error", reject);
    });

    return thumbnailPath;
  } catch (err) {
    console.error("Thumbnail generation failed:", err.message);
    return null;
  }
};

exports.getVideoDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID",
      });
    }

    // Optimized query with lean() and selective field population
    const video = await Video.findById(id)
      .populate("userId", "username avatar subscribersCount")
      .populate({
        path: "comments",
        select: "text user createdAt likes dislikes likeCount",
        populate: { path: "user", select: "username avatar" },
        options: { limit: 50, sort: { createdAt: -1 } } // Limit comments for performance
      })
      .lean(); // Use lean for better performance

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Add computed fields
    video.likeCount = video.likes?.length || 0;
    video.dislikeCount = video.dislikes?.length || 0;

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (err) {
    console.error("Error in getVideoDetails:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch video details",
    });
  }
};

// Like a video
exports.likeVideo = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const videoId = req.params.id;

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new AppError("Invalid user ID", 401));
  }

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return next(new AppError("Invalid video ID", 400));
  }

  // Find the video with basic data
  const video = await Video.findById(videoId).select("likes dislikes userId");

  if (!video) {
    return next(new AppError("No video found with that ID", 404));
  }

  // Verify video owner exists
  const ownerExists = await User.exists({ _id: video.userId });
  if (!ownerExists) {
    await Video.deleteOne({ _id: video._id });
    return next(new AppError("Video owner no longer exists", 410)); // 410 Gone
  }

  // Check if already liked
  const alreadyLiked = video.likes.some((id) => id.equals(userId));
  if (alreadyLiked) {
    return res.status(200).json({
      status: "success",
      message: "You already liked this video",
    });
  }

  // Update likes - remove from dislikes if present, then add to likes
  video.dislikes.pull(userId);
  video.likes.addToSet(userId);
  await video.save();

  // Create notification (only if not self-like)
  if (!video.userId.equals(userId)) {
    await Notification.create({
      recipient: video.userId,
      sender: userId,
      type: "like",
      video: video._id,
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      likes: video.likes.length,
      dislikes: video.dislikes.length,
    },
  });
});

// Dislike a video
exports.dislikeVideo = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const videoId = req.params.id;

  // 1. Validate IDs
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new AppError("Invalid user ID", 401));
  }

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return next(new AppError("Invalid video ID", 400));
  }

  // 2. Find the video with owner check
  const video = await Video.findById(videoId);

  if (!video) {
    return next(new AppError("No video found with that ID", 404));
  }

  // 3. Verify video owner exists (if present)
  if (video.userId) {
    const ownerExists = await User.exists({ _id: video.userId });
    if (!ownerExists) {
      await Video.deleteOne({ _id: video._id });
      return next(
        new AppError("Video owner no longer exists - video removed", 410)
      );
    }
  }

  // 4. Check if already disliked
  const alreadyDisliked = video.dislikes.some((id) => id.equals(userId));
  if (alreadyDisliked) {
    return res.status(200).json({
      status: "success",
      message: "You already disliked this video",
    });
  }

  // 5. Update likes/dislikes
  video.likes.pull(userId);
  video.dislikes.addToSet(userId);
  await video.save();

  // 6. Remove like notification if exists (only if video has a valid user)
  if (video.userId && !video.userId.equals(userId)) {
    await Notification.findOneAndDelete({
      recipient: video.userId,
      sender: userId,
      type: "like",
      video: videoId,
    });
  }

  // 7. Return response with counts
  res.status(200).json({
    status: "success",
    data: {
      likes: video.likes.length,
      dislikes: video.dislikes.length,
      likeCount: video.likes.length,
      dislikeCount: video.dislikes.length,
    },
  });
});

exports.uploadVideo = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  ensureUploadDirectories(); // Make sure directories exist

  let tempVideoPath = req.file?.path;
  let finalVideoPath = null;
  let thumbnailPath = null;

  try {
    // 1. Validate file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No video file uploaded",
      });
    }

    // 2. Validate required fields
    const { title, description, userId, tags } = req.body;
    if (!title || !userId) {
      cleanupFiles(tempVideoPath);
      return res.status(400).json({
        success: false,
        message: "Title and userId are required",
      });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const videoFilename = `${uniqueSuffix}${path.extname(
      req.file.originalname
    )}`;
    const thumbnailFilename = `${uniqueSuffix}.jpg`;

    finalVideoPath = path.join(VIDEOS_PATH, videoFilename);
    thumbnailPath = path.join(THUMBNAILS_PATH, thumbnailFilename);

    // 3. Move uploaded file to permanent location
    fs.renameSync(tempVideoPath, finalVideoPath);
    tempVideoPath = null; // Mark as moved

    // 4. Extract video duration and metadata
    let duration = 0;
    try {
      const metadata = await ffprobe(finalVideoPath);
      duration = metadata.format.duration || 0;
    } catch (err) {
      console.error("Error extracting video metadata:", err);
      // Set a default duration if metadata extraction fails
      duration = 0;
    }

    // 5. Process thumbnail
    let thumbnailUrl = "/default-thumbnail.jpg";

    const generatedThumbnailPath = await generateThumbnail(
      finalVideoPath,
      THUMBNAILS_PATH,
      thumbnailFilename
    );

    if (generatedThumbnailPath) {
      thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
    }

    // 6. Create video document
    const newVideo = new Video({
      title,
      description: description || "",
      videoUrl: `/uploads/videos/${videoFilename}`,
      thumbnailUrl,
      userId,
      duration: Math.round(duration),
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
    });

    await newVideo.save();

    await session.commitTransaction();

    // 7. Success response
    res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: {
        id: newVideo._id,
        title: newVideo.title,
        videoUrl: newVideo.videoUrl,
        thumbnailUrl: newVideo.thumbnailUrl,
        duration: newVideo.duration,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    // Clean up any created files
    cleanupFiles(tempVideoPath, finalVideoPath, thumbnailPath);

    console.error("Upload error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Video processing failed",
    });
  }
};

// Helper function to clean up files
function cleanupFiles(...filePaths) {
  filePaths.forEach((filePath) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting file:", filePath, err);
    }
  });
}

exports.getVideos = async (req, res) => {
  try {
    const {
      search,
      limit = 20,
      skip = 0,
      sort = "-createdAt",
      userId,
      visibility = "public",
      category,
    } = req.query;
    let query = { visibility };

    // Search functionality
    if (search) {
      const sanitizedSearch = search.replace(/[^\w\s]/gi, "");
      query.$text = { $search: sanitizedSearch };
    }

    // Category filter
    if (category && category !== "All" && category !== "Recently uploaded") {
      query.tags = { $regex: new RegExp(category, "i") };
    }

    // Filter by user if specified
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    }

    // Execute count and fetch in parallel for better performance
    const [videos, totalCount] = await Promise.all([
      Video.find(query)
        .populate("userId", "username avatar subscribersCount")
        .select(
          "title description videoUrl thumbnailUrl duration views likes dislikes tags createdAt userId"
        )
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .sort(sort)
        .lean(), // Use lean for better performance
      Video.countDocuments(query)
    ]);

    // Format duration and add computed fields
    const formattedVideos = videos.map((video) => ({
      ...video,
      duration: formatDuration(video.duration),
      likeCount: video.likes?.length || 0,
      dislikeCount: video.dislikes?.length || 0,
    }));

    res.status(200).json({
      status: "success",
      results: formattedVideos.length,
      total: totalCount,
      data: formattedVideos,
    });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch videos",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Helper function to format seconds to HH:MM:SS
function formatDuration(seconds) {
  if (!seconds) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`
    : `${minutes}:${secs.toString().padStart(2, "0")}`;
}

exports.streamVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const videoPath = path.join(__dirname, "..", video.videoUrl.replace(/^\//, ""));
    if (!fs.existsSync(videoPath)) {
      console.error("Video file not found at:", videoPath);
      return res.status(404).json({ error: "Video file missing" });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }

    // View count increment removed from here to prevent double-counting.
    // It is now handled by the dedicated /api/videos/:id/view endpoint called by the frontend.
  } catch (err) {
    console.error("Stream error:", err);
    res.status(500).json({ error: "Video streaming failed" });
  }
};

exports.getRecommendedVideos = async (req, res) => {
  try {
    const cacheKey = `rec-${req.params.id}`;
    const cached = recoCache.get(cacheKey);

    // Return cached recommendations if available
    if (cached && cached.length > 0) {
      return res.status(200).json({
        success: true,
        fromCache: true,
        data: cached,
      });
    }

    const currentVideo = await Video.findById(req.params.id);
    if (!currentVideo) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Get recommended videos using aggregation pipeline
    const recommendedVideos = await Video.aggregate([
      {
        $match: {
          _id: { $ne: currentVideo._id }, // Exclude current video
          $or: [
            { tags: { $in: currentVideo.tags } }, // Same tags
            { userId: currentVideo.userId }, // Same creator
          ],
        },
      },
      {
        $addFields: {
          tagMatchCount: {
            $size: {
              $setIntersection: ["$tags", currentVideo.tags],
            },
          },
          isSameCreator: {
            $cond: [{ $eq: ["$userId", currentVideo.userId] }, 1, 0],
          },
        },
      },
      {
        $sort: {
          isSameCreator: -1, // Prioritize same creator
          tagMatchCount: -1, // Then by tag matches
          views: -1, // Then by popularity
        },
      },
      { $limit: 5 }, // Limit to 5 recommendations
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "creator",
        },
      },
      { $unwind: "$creator" },
      {
        $project: {
          title: 1,
          description: 1,
          thumbnailUrl: 1,
          views: 1,
          createdAt: 1,
          "creator.username": 1,
          "creator.avatar": 1,
        },
      },
    ]);

    // Cache the results if we found any
    if (recommendedVideos.length > 0) {
      recoCache.set(cacheKey, recommendedVideos);
    }

    res.status(200).json({
      success: true,
      fromCache: false,
      data: recommendedVideos,
    });
  } catch (err) {
    console.error("Recommendation error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get recommendations",
    });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const video = await Video.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id, // Only owner can delete
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found or unauthorized",
      });
    }

    // Delete associated files
    fs.unlinkSync(path.join(__dirname, "..", video.videoUrl));
    if (video.thumbnailUrl !== "/default-thumbnail.jpg") {
      fs.unlinkSync(path.join(__dirname, "..", video.thumbnailUrl));
    }

    res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete video",
    });
  }
};

// Search videos
exports.searchVideos = async (req, res) => {
  try {
    const videos = await Video.find(
      { $text: { $search: req.params.query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(20)
      .populate("userId", "username avatar");

    res.status(200).json({
      success: true,
      results: videos.length,
      data: videos,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
};

exports.recordView = async (req, res, next) => {
  try {
    const videoId = req.params.id;
    const video = await Video.findById(videoId);

    if (!video) {
      return next(new AppError("Video not found", 404));
    }

    // Try to get userId from token if provided
    let userId = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      const token = req.headers.authorization.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        // Token invalid or expired, ignore
      }
    }

    if (userId) {
      // Check if logged-in user has already viewed
      const hasViewed = video.viewedBy.some(id => id.toString() === userId.toString());
      if (!hasViewed) {
        video.viewedBy.push(userId);
        video.views += 1;
        await video.save();
      }
    } else {
      // Guest view - increment for now
      // (Optional: Implement IP tracking or cookies for guest uniqueness)
      video.views += 1;
      await video.save();
    }

    res.status(200).json({
      status: "success",
      data: {
        views: video.views,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.saveVideo = async (req, res) => {
  try {
    const { videoId } = req.body;
    const userId = req.user._id; // using MongoDB ObjectId

    // Check if video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Get user
    const user = await User.findById(userId);

    // Check if already saved
    if (user.savedVideos.includes(videoId)) {
      return res.status(400).json({ message: "Video already saved" });
    }

    // Add video to savedVideos
    user.savedVideos.push(videoId);
    await user.save();

    res.status(200).json({
      message: "Video saved successfully",
      savedVideos: user.savedVideos,
    });
  } catch (error) {
    console.error("❌ Error saving video:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// -----------------------------
// Get all saved videos
// -----------------------------
exports.getSavedVideos = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).populate("savedVideos");

    res.status(200).json({
      message: "Fetched saved videos successfully",
      savedVideos: user.savedVideos,
    });
  } catch (error) {
    console.error("❌ Error fetching saved videos:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// -----------------------------
// Remove video from saved
// -----------------------------
exports.removeSavedVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);

    user.savedVideos = user.savedVideos.filter(
      (id) => id.toString() !== videoId
    );

    await user.save();

    res.status(200).json({
      message: "Video removed from saved",
      savedVideos: user.savedVideos,
    });
  } catch (error) {
    console.error("❌ Error removing saved video:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getLikedVideos = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { limit = 50, skip = 0 } = req.query;

  // Optimized query with lean, selective fields, and pagination
  const likedVideos = await Video.find({ likes: userId })
    .select("title description thumbnailUrl duration views createdAt userId likes dislikes tags")
    .populate("userId", "username avatar subscribersCount")
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .sort("-createdAt")
    .lean();

  // Add computed fields
  const videosWithCounts = likedVideos.map(video => ({
    ...video,
    likeCount: video.likes?.length || 0,
    dislikeCount: video.dislikes?.length || 0
  }));

  res.status(200).json({
    status: "success",
    results: videosWithCounts.length,
    data: videosWithCounts
  });
});

// Get Watch History
exports.getWatchHistory = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { limit = 50, skip = 0 } = req.query;

  // Optimized query with lean, selective fields, and pagination
  const history = await Video.find({
    viewedBy: userId,
  })
    .select("title description thumbnailUrl duration views createdAt userId likes dislikes tags")
    .populate("userId", "username avatar subscribersCount")
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .sort("-updatedAt") // Most recently viewed/updated first
    .lean();

  // Add computed fields
  const videosWithCounts = history.map(video => ({
    ...video,
    likeCount: video.likes?.length || 0,
    dislikeCount: video.dislikes?.length || 0
  }));

  res.status(200).json({
    status: "success",
    results: videosWithCounts.length,
    data: videosWithCounts,
  });
});
