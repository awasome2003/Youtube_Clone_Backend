const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin_controller");
const supadataController = require("../controllers/supadataController");
const auth = require("../middleware/auth");
const restrictTo = require("../middleware/restrictTo");

// Protect all routes - only admins allowed
router.use(auth);
router.use(restrictTo("admin"));

router.get("/stats", adminController.getStats);
router.get("/users", adminController.getAllUsers);
router.delete("/users/:id", adminController.deleteUser);
router.get("/videos", adminController.getAllVideos);
router.delete("/videos/:id", adminController.deleteVideo);
router.post("/import-youtube", supadataController.importYouTubeVideos);

module.exports = router;
