const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Combined storage decision
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder;
    if (file.fieldname === "video") {
      folder = path.join(__dirname, "../uploads/videos");
    } else if (file.fieldname === "thumbnail") {
      folder = path.join(__dirname, "../uploads/thumbnails");
    }

    // Ensure directory exists
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Combined file filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    const videoTypes = /mp4|mov|avi|mkv/;
    const isValid = videoTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    isValid ? cb(null, true) : cb(new Error("Only video files are allowed!"));
  } else if (file.fieldname === "thumbnail") {
    const imageTypes = /jpeg|jpg|png|gif/;
    const isValid = imageTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    isValid ? cb(null, true) : cb(new Error("Only image files are allowed!"));
  } else {
    cb(new Error("Unexpected field"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

module.exports = upload;
