const express = require("express");
const { body, param } = require('express-validator');
const router = express.Router();
const {
  uploadVideo,
  getVideos,
  streamVideo,
  getRecommendedVideos,
  getVideoDetails,
  likeVideo,
  dislikeVideo,
  deleteVideo,
  searchVideos,
  recordView,
  saveVideo,
  getSavedVideos,
  removeSavedVideo,
  getLikedVideos,
  getWatchHistory
} = require("../controllers/videoController");
const { updateVideo } = require("../controllers/userController");
const upload = require("../utils/upload");
const auth = require("../middleware/auth");
const rateLimit = require("express-rate-limit");
const validate = require("../middleware/validate");

const dislikeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 dislikes per windowMs
});

// Public routes
router.get("/", getVideos);
router.get("/:id",
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  getVideoDetails);
router.get("/:id/stream",
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  streamVideo);
router.get("/:id/recommendations",
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  getRecommendedVideos);
router.get("/search/:query", searchVideos);
// routes/videoRoutes.js
router.post("/:id/view",
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  recordView);

// Protected routes
router.post("/upload", auth, upload.single("video"),
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be less than 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters'),
  validate,
  uploadVideo);
router.patch("/:id/like",
  auth,
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  likeVideo);
router.patch("/:id/dislike",
  auth,
  dislikeLimiter,
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  dislikeVideo);
router.patch("/:id",
  auth,
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  updateVideo);

router.delete("/:id/delete",
  auth,
  param('id').isMongoId().withMessage('Invalid video ID'),
  validate,
  deleteVideo);

// Save video routes
router.post("/save",
  auth,
  body('videoId')
    .isMongoId().withMessage('Invalid video ID'),
  validate,
  saveVideo); // save a video
router.get("/saved/all", auth, getSavedVideos); // get saved videos
router.delete("/saved/:videoId",
  auth,
  param('videoId').isMongoId().withMessage('Invalid video ID'),
  validate,
  removeSavedVideo); // remove saved

// Liked videos route
router.get("/liked/all", auth, getLikedVideos);

// History route
router.get("/history/all", auth, getWatchHistory);

module.exports = router;
