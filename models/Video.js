const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    videoUrl: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^\/uploads\/.+$/.test(v),
        message: "Invalid video URL format",
      },
    },
    thumbnailUrl: {
      type: String,
      default: "/default-thumbnail.jpg",
      validate: {
        validator: (v) => /^\/.*\.(jpg|jpeg|png|gif)$/.test(v),
        message: "Invalid thumbnail URL format",
      },
    },
    duration: {
      type: Number,
      default: 0, // Seconds
      // Remove "required: true" if present
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],

    likes: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    dislikes: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Video must have an owner"],
      validate: {
        validator: async function (userId) {
          const user = await mongoose.model("User").findById(userId);
          return !!user;
        },
        message: "User does not exist",
      },
    },
    tags: {
      type: [String],
      validate: {
        validator: (v) => v.length <= 20,
        message: "Cannot have more than 20 tags",
      },
    },
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
videoSchema.index({ title: "text", description: "text", tags: "text" });
videoSchema.index({ userId: 1, createdAt: -1 }); // For user videos query
videoSchema.index({ views: -1 }); // For popular videos
videoSchema.index({ createdAt: -1 }); // For new videos

// Virtuals
videoSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

videoSchema.virtual("dislikeCount").get(function () {
  return this.dislikes.length;
});

// Middleware to delete associated files when video is removed
videoSchema.pre("remove", async function (next) {
  try {
    const fs = require("fs");
    const path = require("path");

    // Delete video file
    if (this.videoUrl) {
      const videoPath = path.join(__dirname, "..", this.videoUrl);
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    }

    // Delete thumbnail
    if (this.thumbnailUrl && !this.thumbnailUrl.includes("default-thumbnail")) {
      const thumbPath = path.join(__dirname, "..", this.thumbnailUrl);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Static methods
videoSchema.statics.incrementViews = async function (videoId) {
  return this.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
};

module.exports = mongoose.model("Video", videoSchema);
