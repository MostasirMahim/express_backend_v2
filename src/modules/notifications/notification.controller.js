import {
  getUserNotifications,
  markAsRead,
  markAllAsRead
} from "./notification.service.js";
import { successResponse, errorResponse } from "../../utils/response.js";

/**
 * Get current user's notifications
 */
export const getMyNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // req.user._id comes from auth middleware
    const result = await getUserNotifications(req.user._id, page, limit);
    
    return successResponse(res, 200, "Notifications fetched", result);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Mark specific notification as read
 */
export const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await markAsRead(id, req.user._id);
    
    if (!updated) {
        return errorResponse(res, 404, "Notification not found or not owned by you");
    }

    return successResponse(res, 200, "Marked as read");
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Mark all as read
 */
export const markAllRead = async (req, res) => {
  try {
    await markAllAsRead(req.user._id);
    return successResponse(res, 200, "All notifications marked as read");
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};
