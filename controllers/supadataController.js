const { Supadata } = require("@supadata/js");
const Video = require("../models/Video");
const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const supadata = new Supadata({
    apiKey: process.env.SUPADATA_API_KEY || "YOUR_API_KEY",
});

exports.importYouTubeVideos = catchAsync(async (req, res, next) => {
    const { channelId, playlistId, limit = 10, isShort = false } = req.body;

    if (!channelId && !playlistId) {
        return next(new AppError("Please provide a channelId or playlistId", 400));
    }

    let videoIds = [];

    try {
        if (playlistId) {
            const result = await supadata.youtube.playlist.videos({
                id: playlistId,
                limit,
            });
            videoIds = result.videoIds;
        } else {
            const result = await supadata.youtube.channel.videos({
                id: channelId,
                type: isShort ? "short" : "video",
                limit,
            });
            videoIds = result.videoIds;
        }

        if (!videoIds || videoIds.length === 0) {
            return res.status(200).json({
                status: "success",
                message: "No videos found to import",
                data: []
            });
        }

        // Get current admin user to associate videos with
        const adminUser = await User.findOne({ role: "admin" });
        if (!adminUser) {
            return next(new AppError("Admin user not found to anchor videos", 404));
        }

        const importedVideos = [];

        for (const vidId of videoIds) {
            // Check if video already exists to avoid duplicates
            const existing = await Video.findOne({ videoUrl: { $regex: vidId } });
            if (existing) continue;

            try {
                const metadata = await supadata.youtube.video({ id: vidId });

                const newVideo = new Video({
                    title: metadata.title,
                    description: metadata.description,
                    videoUrl: `https://www.youtube.com/watch?v=${vidId}`, // External URL
                    thumbnailUrl: metadata.thumbnail.url,
                    duration: metadata.duration || 0,
                    userId: adminUser._id,
                    tags: metadata.tags || [],
                    visibility: "public",
                    isShort: isShort
                });

                await newVideo.save();
                importedVideos.push(newVideo);
            } catch (err) {
                console.error(`Failed to fetch metadata for ${vidId}:`, err.message);
            }
        }

        res.status(201).json({
            status: "success",
            results: importedVideos.length,
            message: `Successfully imported ${importedVideos.length} videos`,
            data: importedVideos
        });

    } catch (err) {
        console.error("Supadata Import Error:", err);
        return next(new AppError(`Supadata integration failed: ${err.message}`, 500));
    }
});
