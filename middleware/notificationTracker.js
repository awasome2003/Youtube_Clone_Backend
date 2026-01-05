// middleware/notificationTracker.js
module.exports = catchAsync(async (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode < 400) {
        const unreadCount = await Notification.countDocuments({
          recipient: req.user._id,
          read: false
        });
        // Send to websocket or update user session
        req.io?.to(`user_${req.user._id}`).emit('unreadUpdate', { unreadCount });
      }
    });
    next();
  });