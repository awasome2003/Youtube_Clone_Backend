const Video = require('../models/Video');

module.exports = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    if (!video.userId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this video'
      });
    }

    req.video = video; // Attach video to request
    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};