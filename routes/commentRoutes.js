const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authController = require('../controllers/authController');

// No global protect middleware to allow public access to GET routes

/**
 * @desc    Create a new comment on a video
 * @route   POST /api/videos/:videoId/comments
 * @access  Private
 */
router.post('/videos/:videoId/comments', authController.protect, commentController.addComment);

/**
 * @desc    Get all comments for a video
 * @route   GET /api/videos/:videoId/comments
 * @access  Public
 */
router.get('/videos/:videoId/comments', commentController.getComments);

/**
 * @desc    Update a comment
 * @route   PATCH /api/comments/:commentId
 * @access  Private (comment owner only)
 */
router.patch('/comments/:commentId', authController.protect, commentController.updateComment);

/**
 * @desc    Delete a comment
 * @route   DELETE /api/comments/:commentId
 * @access  Private (comment owner or admin)
 */
router.delete('/comments/:commentId', authController.protect, commentController.deleteComment);

/**
 * @desc    Like a comment
 * @route   PATCH /api/comments/:commentId/like
 * @access  Private
 */
router.patch('/comments/:commentId/like', authController.protect, commentController.likeComment);

/**
 * @desc    Dislike a comment
 * @route   PATCH /api/comments/:commentId/dislike
 * @access  Private
 */
router.patch('/comments/:commentId/dislike', authController.protect, commentController.dislikeComment);

/**
 * @desc    Add a reply to a comment
 * @route   POST /api/comments/:commentId/replies
 * @access  Private
 */
router.post('/comments/:commentId/replies', authController.protect, commentController.addReply);

/**
 * @desc    Get replies for a comment
 * @route   GET /api/comments/:commentId/replies
 * @access  Public
 */
router.get('/comments/:commentId/replies', commentController.getReplies);

module.exports = router;