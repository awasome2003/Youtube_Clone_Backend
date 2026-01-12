const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Basic Auth Fields
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username must be less than 30 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    refreshToken: String,

    // Profile Fields
    avatar: {
      type: String,
      default: "default.jpg",
    },
    banner: {
      type: String,
      default: "default-banner.jpg",
    },
    channelName: {
      type: String,
      trim: true,
      maxlength: [50, "Channel name must be less than 50 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description must be less than 500 characters"],
      default: "",
    },
    website: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return (
            v === "" ||
            /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(
              v
            )
          );
        },
        message: (props) => `${props.value} is not a valid URL!`,
      },
    },

    // Channel Stats
    subscribersCount: {
      type: Number,
      default: 0,
    },
    subscribedChannels: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    totalViews: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    savedVideos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    watchLater: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video",
      },
    ],

    // Timestamps (you already have { timestamps: true })
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance optimization
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ subscribedChannels: 1 });
userSchema.index({ watchLater: 1 });
userSchema.index({ savedVideos: 1 });

// Virtual for subscriber relationship (reverse of subscribedChannels)
userSchema.virtual("subscribers", {
  ref: "User",
  localField: "_id",
  foreignField: "subscribedChannels",
});

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Update subscribersCount when subscribedChannels changes
userSchema.pre("save", function (next) {
  if (this.isModified("subscribedChannels")) {
    this.subscribersCount = this.subscribedChannels.length;
  }
  next();
});

// Password verification method
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if user is subscribed to a channel
userSchema.methods.isSubscribed = function (channelId) {
  return this.subscribedChannels.some((id) => id.equals(channelId));
};

module.exports = mongoose.model("User", userSchema);
