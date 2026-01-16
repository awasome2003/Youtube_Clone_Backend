const Playlist = require("../models/Playlist");

// Create new playlist
exports.createPlaylist = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

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
    const playlist = await Playlist.findOne({ _id: req.params.playlistId, user: req.user.id });

    if (!playlist) return res.status(404).json({ error: "Playlist not found or access denied" });

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
    const playlist = await Playlist.findOne({ _id: req.params.playlistId, user: req.user.id });

    if (!playlist) return res.status(404).json({ error: "Playlist not found or access denied" });

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
    const playlists = await Playlist.find({ user: req.user.id })
      .populate({
        path: "videos",
        select: "thumbnailUrl"
      })
      .sort("-createdAt");

    // Transform to include first video thumbnail as cover
    const data = playlists.map(pl => {
      const obj = pl.toObject();
      obj.cover = obj.videos.length > 0 ? obj.videos[0].thumbnailUrl : null;
      obj.videoCount = obj.videos.length;
      obj.videoIds = obj.videos.map(v => v._id);
      delete obj.videos; // Don't send all video details in list view
      return obj;
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single playlist details
exports.getPlaylistById = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId)
      .populate({
        path: "videos",
        populate: { path: "userId", select: "username avatar" }
      })
      .populate("user", "username avatar");

    if (!playlist) return res.status(404).json({ error: "Playlist not found" });

    // Check visibility logic if we implemented privacy, for now assume public or owner
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete playlist
exports.deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndDelete({
      _id: req.params.playlistId,
      user: req.user.id
    });

    if (!playlist) return res.status(404).json({ error: "Playlist not found or access denied" });

    res.json({ message: "Playlist deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
