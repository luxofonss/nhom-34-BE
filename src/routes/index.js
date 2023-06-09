"use strict";

const express = require("express");
const router = express.Router();

router.use("/v1/api/notification", require("./notification"));
router.use("/v1/api/conversation", require("./conversation"));
router.use("/v1/api/message", require("./message"));
router.use("/v1/api/order", require("./order"));
router.use("/v1/api/category", require("./category"));
router.use("/v1/api/discount", require("./discount"));
router.use("/v1/api/checkout", require("./checkout"));
router.use("/v1/api/user", require("./user"));

router.use("/v1/api/cart", require("./cart"));
router.use("/v1/api/product", require("./product"));
router.use("/v1/api", require("./access"));

module.exports = router;
