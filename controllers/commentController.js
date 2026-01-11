const Comment = require("../models/Comment");
const Video = require("../models/Video");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 * @desc    Add a comment to a video
 * @route   POST /api/videos/:videoId/comments
 * @access  Private
 */
exports.addComment = catchAsync(async (req, res, next) => {
  const { videoId } = req.params;
  const { text, parentCommentId } = req.body;

  // Validate input
  if (!text) return next(new AppError("Comment text is required", 400));

  // Check video exists
  const video = await Video.findById(videoId);
  if (!video) return next(new AppError("No video found with that ID", 404));

  // Check parent comment exists if replying
  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment)
      return next(new AppError("Parent comment not found", 404));
    if (parentComment.video.toString() !== videoId) {
      return next(
        new AppError("Parent comment does not belong to this video", 400)
      );
    }
  }

  // Create comment
  const comment = await Comment.create({
    user: req.user._id,
    video: videoId,
    text,
    parentComment: parentCommentId || null,
  });

  // If it's a reply, add to parent's replies
  if (parentCommentId) {
    await Comment.findByIdAndUpdate(parentCommentId, {
      $push: { replies: comment._id },
    });
  } else {
    // If it's a top-level comment, add to video's comments array
    await Video.findByIdAndUpdate(videoId, {
      $push: { comments: comment._id }
    });
  }

  // Populate user details
  await comment.populate("user", "username avatar");

  res.status(201).json({
    status: "success",
    data: { comment },
  });
});

/**
 * @desc    Get all comments for a video
 * @route   GET /api/videos/:videoId/comments
 * @access  Public
 */
exports.getComments = catchAsync(async (req, res, next) => {
  const { videoId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // Check video exists
  if (!(await Video.exists({ _id: videoId }))) {
    return next(new AppError("No video found with that ID", 404));
  }

  const comments = await Comment.find({
    video: videoId,
    parentComment: null, // Only top-level comments
  })
    .populate("user", "username avatar")
    .populate({
      path: "replies",
      select: "text user createdAt",
      perDocumentLimit: 3,
      populate: {
        path: "user",
        select: "username avatar",
      },
    })
    .sort("-createdAt")
    .skip((page - 1) * limit)
    .limit(limit);

  const formattedComments = comments.map(comment => {
    const obj = comment.toObject();
    return {
      ...obj,
      likeCount: (obj.likes && Array.isArray(obj.likes)) ? obj.likes.length : 0,
      dislikeCount: (obj.dislikes && Array.isArray(obj.dislikes)) ? obj.dislikes.length : 0
    };
  });

  const total = await Comment.countDocuments({
    video: videoId,
    parentComment: null,
  });

  res.status(200).json({
    status: "success",
    results: formattedComments.length,
    total,
    data: { comments: formattedComments },
  });
});

/**
 * @desc    Like a comment
 * @route   PATCH /api/comments/:commentId/like
 * @access  Private
 */
exports.likeComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return next(new AppError("Comment not found", 404));

  const userId = req.user._id;
  const isLiked = comment.likes.includes(userId);

  if (isLiked) {
    comment.likes.pull(userId);
  } else {
    comment.dislikes.pull(userId);
    comment.likes.push(userId);
  }

  await comment.save();

  res.status(200).json({
    status: "success",
    data: {
      likes: comment.likes.length,
      dislikes: comment.dislikes.length,
      isLiked: !isLiked
    }
  });
});

/**
 * @desc    Dislike a comment
 * @route   PATCH /api/comments/:commentId/dislike
 * @access  Private
 */
exports.dislikeComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return next(new AppError("Comment not found", 404));

  const userId = req.user._id;
  const isDisliked = comment.dislikes.includes(userId);

  if (isDisliked) {
    comment.dislikes.pull(userId);
  } else {
    comment.likes.pull(userId);
    comment.dislikes.push(userId);
  }

  await comment.save();

  res.status(200).json({
    status: "success",
    data: {
      likes: comment.likes.length,
      dislikes: comment.dislikes.length,
      isDisliked: !isDisliked
    }
  });
});

/**
 * @desc    Update a comment
 * @route   PATCH /api/comments/:commentId
 * @access  Private (comment owner only)
 */
exports.updateComment = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;
  const { text } = req.body;

  // 1) Find comment
  const comment = await Comment.findById(commentId);
  if (!comment) {
    return next(new AppError("No comment found with that ID", 404));
  }

  // 2) Check if user owns the comment
  if (comment.user.toString() !== req.user._id.toString()) {
    return next(
      new AppError("You are not authorized to edit this comment", 403)
    );
  }

  // 3) Update comment
  comment.text = text || comment.text;
  const updatedComment = await comment.save();

  // 4) Populate user details
  await updatedComment.populate("user", "username avatar");

  res.status(200).json({
    status: "success",
    data: {
      comment: updatedComment,
    },
  });
});

/**
 * @desc    Delete a comment
 * @route   DELETE /api/comments/:commentId
 * @access  Private (comment owner or admin)
 */
exports.deleteComment = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;

  // 1) Find comment
  const comment = await Comment.findById(commentId);
  if (!comment) {
    return next(new AppError("No comment found with that ID", 404));
  }

  // 2) Check permissions
  const isOwner = comment.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin"; // Assuming you have role in user model

  if (!isOwner && !isAdmin) {
    return next(
      new AppError("You are not authorized to delete this comment", 403)
    );
  }

  // 3) Delete comment
  await Comment.findByIdAndDelete(commentId);

  res.status(204).json({
    status: "success",
    data: null,
  });
});

/**
 * @desc    Add a reply to a comment
 * @route   POST /api/comments/:commentId/replies
 * @access  Private
 */
exports.addReply = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;
  const { text } = req.body;

  // 1) Validate input
  if (!text) {
    return next(new AppError("Reply text is required", 400));
  }

  // 2) Check if parent comment exists
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    return next(new AppError("No comment found with that ID", 404));
  }

  // 3) Create reply
  const reply = await Comment.create({
    user: req.user._id,
    video: parentComment.video,
    text,
    parentComment: commentId,
  });

  // 4) Add reply to parent comment
  parentComment.replies.push(reply._id);
  await parentComment.save();

  // 5) Populate user details
  await reply.populate("user", "username avatar");

  res.status(201).json({
    status: "success",
    data: {
      reply,
    },
  });
});

/**
 * @desc    Get replies for a comment
 * @route   GET /api/comments/:commentId/replies
 * @access  Public
 */
exports.getReplies = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const parentComment = await Comment.findById(commentId);
  if (!parentComment)
    return next(new AppError("Parent comment not found", 404));

  const replies = await Comment.find({ parentComment: commentId })
    .populate("user", "username avatar")
    .sort("createdAt")
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Comment.countDocuments({ parentComment: commentId });

  res.status(200).json({
    status: "success",
    results: replies.length,
    total,
    data: { replies },
  });
});
