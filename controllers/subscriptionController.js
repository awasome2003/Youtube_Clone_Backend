const User = require('../models/User');
const AppError = require('../utils/appError');

exports.subscribe = async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const userId = req.user._id;

    // 1) Check if channel exists
    const channel = await User.findById(channelId);
    if (!channel) {
      return next(new AppError('Channel not found', 404));
    }

    // 2) Check if already subscribed
    if (channel.subscribers.includes(userId)) {
      return next(new AppError('Already subscribed to this channel', 400));
    }

    // 3) Add subscription
    await User.findByIdAndUpdate(
      channelId,
      { $addToSet: { subscribers: userId } },
      { new: true }
    );

    // 4) Add to user's subscriptions
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { subscribedChannels: channelId } },
      { new: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Successfully subscribed to channel'
    });
  } catch (err) {
    next(err);
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const userId = req.user._id;

    // 1) Remove from channel's subscribers
    await User.findByIdAndUpdate(
      channelId,
      { $pull: { subscribers: userId } },
      { new: true }
    );

    // 2) Remove from user's subscriptions
    await User.findByIdAndUpdate(
      userId,
      { $pull: { subscribedChannels: channelId } },
      { new: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Successfully unsubscribed from channel'
    });
  } catch (err) {
    next(err);
  }
};