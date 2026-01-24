import Notification from "./notification.model.js";
import { publishMessage } from "../../config/rabbitmq.js";
import logger from "../../utils/logger.js";

/**
 * Service to create and trigger notifications
 */
export const createNotification = async ({
  recipientId,
  type,
  title,
  message,
  data = {},
  channels = ["IN_APP"] // Default to just internal notification
}) => {
  try {
    // 1. Save to Database (Reliability)
    const notification = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      data,
      channels,
      status: "QUEUED"
    });

    // 2. Push to RabbitMQ for Async Processing (Performance)
    const payload = {
      notificationId: notification._id,
      recipientId,
      type,
      title,
      message,
      data,
      channels
    };

    const published = await publishMessage("notification", payload);

    if (!published) {
      logger.warn(`Failed to publish notification ${notification._id} to RabbitMQ. It will stay in QUEUED state.`);
      // Optional: Fallback to direct sending or a cron job will pick it up
    }

    return notification;
  } catch (error) {
    logger.error(`Error creating notification: ${error.message}`);
    throw error;
  }
};

/**
 * Get user's notifications
 */
export const getUserNotifications = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const notifications = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments({ recipient: userId });
  const unreadCount = await Notification.countDocuments({ recipient: userId, readAt: null });

  return {
    notifications,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit)
    },
    unreadCount
  };
};

/**
 * Mark as read
 */
export const markAsRead = async (notificationId, userId) => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { status: "READ", readAt: new Date() },
    { new: true }
  );
};

export const markAllAsRead = async (userId) => {
    return await Notification.updateMany(
        { recipient: userId, readAt: null },
        { status: "READ", readAt: new Date() }
    );
};

export default {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead
};
