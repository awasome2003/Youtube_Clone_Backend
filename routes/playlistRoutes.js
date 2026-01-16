const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const playlistController = require("../controllers/playlistController");

// Create new playlist
router.post("/", auth, playlistController.createPlaylist);

// Add video to playlist
router.post("/:playlistId/add", auth, playlistController.addToPlaylist);

// Remove video from playlist
router.post("/:playlistId/remove", auth, playlistController.removeFromPlaylist);

// Get single playlist
router.get("/:playlistId", auth, playlistController.getPlaylistById);

// Delete playlist
router.delete("/:playlistId", auth, playlistController.deletePlaylist);

// Get all user playlists
router.get("/", auth, playlistController.getUserPlaylists);

module.exports = router;
