require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer"); // Added Multer import
const rateLimit = require("express-rate-limit");
const { validationResult } = require("express-validator");
const router = express.Router();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      if (req.originalUrl.includes("/api/notification") && buf.length === 0) {
        throw new Error("Empty body not allowed");
      }
      try {
        if (buf.length > 0) JSON.parse(buf.toString(encoding || "utf8"));
      } catch (e) {
        throw new Error("Invalid JSON");
      }
    },
    limit: "10kb",
  })
);

// Add this error handling middleware right after:
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError || err.message === "Invalid JSON") {
    return res.status(400).json({
      status: "error",
      message: "Invalid JSON payload",
    });
  }
  if (err.message === "Empty body not allowed") {
    return res.status(400).json({
      status: "error",
      message: "Request body cannot be empty",
    });
  }
  next(err);
});

// Rate limiting
const notificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP
});




// Special middleware for handling multipart/form-data
app.use((req, res, next) => {
  if (req.originalUrl === "/api/videos" && req.method === "POST") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Regular middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://youtube-clone-frontend-ruddy.vercel.app/", // <-- CHANGE THIS
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (Postman, mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// handle preflight
app.options("*", cors());

app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/youtube-clone", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.get("/", (req, res) => {
  res.send("YouTube Clone API");
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Import Routes
const authRoutes = require("./routes/auth_routes");
const videoRoutes = require("./routes/video_routes");
const userRoutes = require("./routes/UserRoutes");
const commentRoutes = require("./routes/commentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/users", userRoutes);
app.use("/api", commentRoutes);
app.use("/api/notification", notificationRoutes);


// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  }

  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
