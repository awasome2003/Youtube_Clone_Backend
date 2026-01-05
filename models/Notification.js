const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: function () {
        return !this.type?.startsWith("system-");
      },
    },
    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "reply",
        "subscribe",
        "mention",
        "new-video",
        "system-alert",
        "system-update",
      ],
      required: true,
      index: true,
    },
    video: {
      type: mongoose.Schema.ObjectId,
      ref: "Video",
    },
    comment: {
      type: mongoose.Schema.ObjectId,
      ref: "Comment",
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      immutable: true,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual message
notificationSchema.virtual("message").get(function () {
  const messages = {
    like: "liked your video",
    comment: "commented on your video",
    reply: "replied to your comment",
    subscribe: "subscribed to your channel",
    mention: "mentioned you in a comment",
    "new-video": "uploaded a new video",
    "system-alert": `System Alert: ${this.metadata?.message || ""}`,
    "system-update": `Update: ${this.metadata?.message || ""}`,
  };

  return this.type.startsWith("system-")
    ? messages[this.type]
    : `${this.sender?.username || "User"} ${messages[this.type]}`;
});

// Virtual link
notificationSchema.virtual("link").get(function () {
  if (this.type.startsWith("system-"))
    return this.metadata?.link || "/notifications";

  if (["like", "comment", "new-video"].includes(this.type)) {
    return this.video ? `/watch/${this.video}` : "#";
  }

  if (["reply", "mention"].includes(this.type)) {
    return this.video && this.comment
      ? `/watch/${this.video}?comment=${this.comment}`
      : "#";
  }

  if (this.type === "subscribe") {
    return this.sender ? `/channel/${this.sender}` : "#";
  }

  return "/notifications";
});

// Static method to mark all as read
notificationSchema.statics.markAllRead = function (recipientId) {
  return this.updateMany(
    { recipient: recipientId, read: false },
    { $set: { read: true } }
  );
};

// System notification shortcut
notificationSchema.statics.createSystemNotification = function (
  recipientId,
  type,
  message,
  link
) {
  return this.create({
    recipient: recipientId,
    type,
    metadata: { message, link },
    read: false,
  });
};

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
