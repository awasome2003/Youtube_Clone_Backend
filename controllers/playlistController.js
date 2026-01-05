const Playlist = require("../models/Playlist");

// Create new playlist
exports.createPlaylist = async (req, res) => {
  try {
    const { name } = req.body;
    const playlist = new Playlist({ user: req.user.id, name, videos: [] });
    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add video to playlist
exports.addToPlaylist = async (req, res) => {
  try {
    const { videoId } = req.body;
    const playlist = await Playlist.findById(req.params.playlistId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });

    if (!playlist.videos.includes(videoId)) {
      playlist.videos.push(videoId);
      await playlist.save();
    }
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove video from playlist
exports.removeFromPlaylist = async (req, res) => {
  try {
    const { videoId } = req.body;
    const playlist = await Playlist.findById(req.params.playlistId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });

    playlist.videos = playlist.videos.filter(id => id.toString() !== videoId);
    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all user playlists
exports.getUserPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ user: req.user.id }).populate("videos");
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
