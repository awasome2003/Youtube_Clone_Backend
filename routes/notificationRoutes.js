const express = require("express");
const router = express.Router();
const { param, query, body } = require("express-validator");

const authController = require("../controllers/authController");
const notificationController = require("../controllers/notificationController");
const validate = require("../middleware/validate");
const restrictTo = require("../middleware/restrictTo");

// ================================
// Constants
// ================================
const USER_NOTIFICATION_TYPES = [
  "like",
  "comment",
  "reply",
  "subscribe",
  "mention",
  "new-video",
];
const SYSTEM_NOTIFICATION_TYPES = ["system-alert", "system-update"];
const ALL_NOTIFICATION_TYPES = [
  ...USER_NOTIFICATION_TYPES,
  ...SYSTEM_NOTIFICATION_TYPES,
];

// ================================
// Middleware: All routes protected
// ================================
router.use(authController.protect);

// ================================
// Routes
// ================================

/**
 * GET /api/notifications
 * Fetch paginated notifications for current user
 */
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("sort").optional().isIn(["createdAt", "-createdAt", "read", "-read"]),
    query("type").optional().isIn(ALL_NOTIFICATION_TYPES),
    query("read").optional().isBoolean().toBoolean(),
  ],
  validate,
  notificationController.getUserNotifications
);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch(
  "/:id/read",
  [param("id").isMongoId()],
  validate,
  notificationController.markAsRead
);

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
router.patch("/mark-all-read", notificationController.markAllAsRead);

/**
 * DELETE /api/notifications/:id
 * Delete a specific notification
 */
router.delete(
  "/:id",
  [param("id").isMongoId()],
  validate,
  notificationController.deleteNotification
);

/**
 * POST /api/notifications/system
 * Create a system notification (admin only)
 */
router.post(
  "/system",
  [
    restrictTo("admin"),
    body("type").isIn(SYSTEM_NOTIFICATION_TYPES),
    body("message").isString().notEmpty().trim().escape(),
    body("link").optional().isURL({ require_protocol: true }),
    body("recipients").isArray({ min: 1 }),
    body("recipients.*").isMongoId(),
  ],
  validate,
  notificationController.createNotification
);

/**
 * POST /api/notifications/batch
 * Create batch notifications (internal use)
 */
router.post(
  "/batch",
  [
    body("notifications").isArray({ min: 1 }),

    body("notifications.*.type").isIn(ALL_NOTIFICATION_TYPES),
    body("notifications.*.recipientId").isMongoId(),

    body("notifications.*.senderId")
      .if(body("notifications.*.type").isIn(USER_NOTIFICATION_TYPES))
      .isMongoId(),

    body("notifications.*.videoId")
      .if(body("notifications.*.type").isIn(["like", "comment", "new-video"]))
      .isMongoId(),

    body("notifications.*.commentId")
      .if(body("notifications.*.type").isIn(["reply", "mention"]))
      .isMongoId(),
  ],
  validate,
  notificationController.createBatchNotifications
);

module.exports = router;
