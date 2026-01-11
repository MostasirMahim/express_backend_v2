import { User } from "../modules/auth/auth.model.js";

/**
 * Middleware to check if the user has the required permission.
 * Assumes req.user is populated with at least required info (e.g., _id) from a previous auth middleware.
 * Use this AFTER your authentication middleware.
 *
 * @param {string|string[]} requiredPermission - The permission slug(s) required. If array, requires AT LEAST ONE.
 */
export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // 1. Check if user is authenticated
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. User authentication required.",
        });
      }

      // 2. Fetch full user details with Roles and Permissions
      // We explicitly query here to ensure we have the latest permissions state
      const user = await User.findById(req.user._id)
        .populate({
          path: "roles",
          select: "predictions name slug",
          populate: {
            path: "permissions",
            select: "slug name",
          },
        })
        .populate({
          path: "permissions", // Direct user permissions
          select: "slug name",
        })
        .lean(); // Use lean for performance as we just need to read

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User account not found.",
        });
      }

      // 3. Aggregate all permission slugs
      const userPermissions = new Set();

      // Add direct permissions
      if (user.permissions && user.permissions.length > 0) {
        user.permissions.forEach((perm) => {
          if (perm && perm.slug) userPermissions.add(perm.slug);
        });
      }

      // Add permissions from roles
      if (user.roles && user.roles.length > 0) {
        user.roles.forEach((role) => {
          if (role && role.permissions) {
            role.permissions.forEach((perm) => {
              if (perm && perm.slug) userPermissions.add(perm.slug);
            });
          }
        });
      }

      // 4. Verify against required permissions
      const required = Array.isArray(requiredPermission)
        ? requiredPermission
        : [requiredPermission];

      // Check if user has AT LEAST ONE of the required permissions
      // (OR logic). If you need AND logic, this would need adjustment.
      const hasPermission = required.some((perm) => userPermissions.has(perm));

      // Optional: Allow "admin" or "super_admin" role to bypass checks?
      // const isSuperAdmin = user.roles.some(r => r.slug === 'super_admin');
      // if (isSuperAdmin) hasPermission = true;

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "Forbidden. You do not have the required permission.",
          requiredPermissions: required,
        });
      }

      // Attach aggregated permissions to req for use in controllers if needed
      req.userPermissions = Array.from(userPermissions);
      req.userRoles = user.roles ? user.roles.map((r) => r.slug) : [];

      next();
    } catch (error) {
      console.error("RBAC Middleware Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error during permission check.",
      });
    }
  };
};
