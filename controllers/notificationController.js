const Notification = require("../models/Notification");
const User = require("../models/User");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");
const mongoose = require("mongoose");

/**
 * @desc    Get notifications for the logged-in user
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getUserNotifications = catchAsync(async (req, res, next) => {
  const baseQuery = Notification.find({ recipient: req.user._id });

  const features = new APIFeatures(baseQuery, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  let notifications;
  try {
    const queryResult = await features.query
      .populate({
        path: "sender",
        select: "username avatar channelName isVerified",
        transform: (doc) =>
          doc || {
            username: "Deleted User",
            avatar: "default-avatar.jpg",
            isVerified: false,
          },
      })
      .populate({
        path: "video",
        select: "title thumbnailUrl status",
        match: { status: "public" },
        transform: (doc) => doc || null,
      })
      .populate({
        path: "comment",
        select: "text isDeleted",
        match: { isDeleted: false },
        transform: (doc) => doc || null,
      })
      .lean();

    notifications = Array.isArray(queryResult) ? queryResult : [];
  } catch (error) {
    console.error("Error executing notification query:", error);
    return next(new AppError("Failed to retrieve notifications", 500));
  }

  // Filter out invalid/incomplete notifications
  const validNotifications = notifications.filter((notif) => {
    if (!notif || typeof notif !== "object") return false;

    switch (notif.type) {
      case "like":
      case "comment":
      case "new-video":
        return notif?.video?._id;
      case "reply":
      case "mention":
        return notif?.comment?._id;
      case "subscribe":
        return true;
      default:
        return false;
    }
  });

  res.status(200).json({
    status: "success",
    results: validNotifications.length,
    data: validNotifications,
  });
});

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      recipient: req.user._id,
    },
    { read: true },
    {
      new: true,
      runValidators: true,
    }
  ).populate("sender", "username avatar");

  if (!notification) {
    return next(new AppError("Notification not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      notification: {
        ...notification.toObject(),
        message: notification.message,
      },
    },
  });
});

/**
 * @desc    Mark all user notifications as read
 * @route   PATCH /api/notifications/mark-all-read
 * @access  Private
 */
exports.markAllAsRead = catchAsync(async (req, res, next) => {
  const result = await Notification.markAllRead(req.user._id);

  res.status(200).json({
    status: "success",
    data: {
      modifiedCount: result.modifiedCount || result.nModified || 0,
    },
  });
});

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) {
    return next(new AppError("Notification not found", 404));
  }

  res.status(204).json({ status: "success", data: null });
});

/**
 * @desc    Create a single notification
 * @route   Internal
 * @access  Protected
 */
exports.createNotification = catchAsync(async (req, res, next) => {
  const { recipientId, senderId, type, videoId, commentId, metadata } =
    req.body;

  if (!type || !recipientId) {
    return next(
      new AppError("Notification type and recipient are required", 400)
    );
  }

  const notification = await Notification.create({
    recipient: recipientId,
    sender: senderId,
    type,
    video: videoId,
    comment: commentId,
    metadata,
  });

  res.status(201).json({
    status: "success",
    data: { notification },
  });
});

/**
 * @desc    Batch create notifications with preference and duplicate checks
 * @route   Internal
 * @access  Protected
 */
exports.createBatchNotifications = async (notificationsData) => {
  try {
    const validNotifications = [];

    for (const data of notificationsData) {
      const { recipientId, senderId, type } = data;

      if (!recipientId || !type) continue;
      if (recipientId.toString() === senderId?.toString()) continue;

      const recipient = await User.findById(recipientId).select(
        "+notificationPreferences"
      );
      if (!recipient || recipient.notificationPreferences?.[type] === false)
        continue;

      validNotifications.push(data);
    }

    if (validNotifications.length > 0) {
      return await Notification.insertMany(validNotifications);
    }

    return [];
  } catch (err) {
    console.error("[Batch Notification Error]", err);
    return [];
  }
};

/**
 * @desc    Fallback notification message builder (not needed if using virtual)
 */
exports._generateNotificationMessage = (notification) => {
  const map = {
    like: "liked your video",
    comment: "commented on your video",
    reply: "replied to your comment",
    subscribe: "subscribed to your channel",
    mention: "mentioned you in a comment",
    "new-video": "uploaded a new video",
  };

  const sender = notification.sender?.username || "Someone";
  return `${sender} ${map[notification.type] || "performed an action"}`;
};
