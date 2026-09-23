const express = require("express");
const userController = require("../controllers/userController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

// All user management routes require valid authentication
router.use(authenticate);

// 1. List users (Requires USER_VIEW)
router.get("/", authorize("USER_VIEW"), userController.getUsers);

// 2. Create/Invite user (Requires USER_CREATE)
router.post("/", authorize("USER_CREATE"), userController.createUser);

// 3. Get single user (Requires USER_VIEW)
router.get("/:id", authorize("USER_VIEW"), userController.getUserById);

// 4. Update user profile (Requires USER_UPDATE)
router.patch("/:id", authorize("USER_UPDATE"), userController.updateUser);

// 5. Update user status (Requires USER_DISABLE)
router.patch("/:id/status", authorize("USER_DISABLE"), userController.updateUserStatus);

// 6. Update user roles (Requires USER_ROLE_UPDATE)
router.patch("/:id/roles", authorize("USER_ROLE_UPDATE"), userController.updateUserRoles);

// 7. Soft delete user (Requires USER_DISABLE)
router.delete("/:id", authorize("USER_DISABLE"), userController.deleteUser);

module.exports = router;
