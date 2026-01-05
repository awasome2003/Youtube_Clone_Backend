const express = require("express");
const { body, param } = require('express-validator');
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

// Get user profile by ID
router.get("/:id", 
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  userController.getUserProfile
);

// Get current user profile
router.get("/me", auth, userController.getCurrentUserProfile);

// Update user profile
router.patch("/me", 
  auth,
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('channelName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Channel name must be less than 50 characters'),
  body('website')
    .optional({ checkFalsy: true })
    .isURL({ require_protocol: false })
    .withMessage('Please provide a valid website URL'),
  validate,
  userController.updateUserProfile
);

// Update user avatar
router.patch("/avatar", auth, userController.updateUserAvatar);

// Get user's uploaded videos
router.get("/:id/videos", 
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  userController.getUserVideos
);

// Get current user's uploaded videos
router.get("/me/videos", auth, userController.getCurrentUserVideos);

// Get user's subscriptions
router.get("/:id/subscriptions", 
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  userController.getUserSubscriptions
);

// Get current user's subscriptions
router.get("/me/subscriptions", auth, userController.getCurrentUserSubscriptions);

// Get user's saved videos
router.get("/:id/saved", 
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  userController.getUserSavedVideos
);

// Get current user's saved videos
router.get("/me/saved", auth, userController.getCurrentUserSavedVideos);

module.exports = router;