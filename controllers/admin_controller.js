const User = require("../models/User");
const Video = require("../models/Video");

exports.getStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalVideos = await Video.countDocuments();
        const totalViews = await Video.aggregate([
            { $group: { _id: null, total: { $sum: "$views" } } }
        ]);

        res.status(200).json({
            status: "success",
            data: {
                totalUsers,
                totalVideos,
                totalViews: totalViews[0]?.total || 0
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select("-password");
        res.status(200).json({
            status: "success",
            results: users.length,
            data: { users }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Optionally delete user's videos
        await Video.deleteMany({ userId: req.params.id });

        res.status(204).json({
            status: "success",
            data: null
        });
    } catch (err) {
        next(err);
    }
};

exports.getAllVideos = async (req, res, next) => {
    try {
        const videos = await Video.find().populate("userId", "username email avatar");
        res.status(200).json({
            status: "success",
            results: videos.length,
            data: { videos }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteVideo = async (req, res, next) => {
    try {
        const video = await Video.findByIdAndDelete(req.params.id);
        if (!video) return res.status(404).json({ message: "Video not found" });

        res.status(204).json({
            status: "success",
            data: null
        });
    } catch (err) {
        next(err);
    }
};
