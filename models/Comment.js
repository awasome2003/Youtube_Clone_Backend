const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "Comment must belong to a user"],
  },
  video: {
    type: mongoose.Schema.ObjectId,
    ref: "Video",
    required: [true, "Comment must belong to a video"],
  },
  text: {
    type: String,
    required: [true, "Comment text is required"],
    maxlength: [1000, "Comment cannot exceed 1000 characters"],
    trim: true,
  },
  parentComment: {
    type: mongoose.Schema.ObjectId,
    ref: "Comment",
    default: null,
  },
  replies: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "Comment",
    },
  ],
  isEdited: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
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
});

// Update the 'updatedAt' field before saving
commentSchema.pre("save", function (next) {
  if (this.isModified("text")) {
    this.isEdited = true;
    this.updatedAt = Date.now();
  }
  next();
});

// Indexes for better performance
commentSchema.index({ video: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;
