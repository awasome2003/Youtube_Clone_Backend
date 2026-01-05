// models/Playlist.js
const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true }, // e.g. "Watch Later", "My Favourites"
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
}, { timestamps: true });

module.exports = mongoose.model("Playlist", playlistSchema);
