"use strict";

const express = require("express");
const userController = require("../../controllers/user.controller");
const asyncHandler = require("../../helpers/asyncHandler");
const router = express.Router();
const { authentication } = require("../../auth/authUtils");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/:id", asyncHandler(userController.getShopById));

router.use(asyncHandler(authentication));
router.post("/update/avatar", [
  upload.any(),
  asyncHandler(userController.updateAvatar),
]);
router.put("/update", asyncHandler(userController.updateUserInfo));
router.post("/register", asyncHandler(userController.registerUserAsShop));

module.exports = router;
