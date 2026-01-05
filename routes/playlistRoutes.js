const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const playlistController = require("../controllers/playlistController");

// Create new playlist
router.post("/", authMiddleware, playlistController.createPlaylist);

// Add video to playlist
router.post("/:playlistId/add", authMiddleware, playlistController.addToPlaylist);

// Remove video from playlist
router.post("/:playlistId/remove", authMiddleware, playlistController.removeFromPlaylist);

// Get all user playlists
router.get("/", authMiddleware, playlistController.getUserPlaylists);

module.exports = router;
