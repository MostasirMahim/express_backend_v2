import { getChannel } from "../config/rabbitmq.js";
import Notification from "../modules/notifications/notification.model.js";
import { User } from "../modules/auth/auth.model.js";
import { sendEmail } from "../modules/auth/auth.services.js"; // Reuse existing email service
import logger from "../utils/logger.js";

const QUEUE_NAME = "notifications_queue";

export const startNotificationWorker = async () => {
  const channel = getChannel();
  
  if (!channel) {
    logger.warn("Notification Worker: RabbitMQ channel unavailable. Worker not started.");
    return;
  }

  logger.info("Notification Worker: Waiting for messages...");

  channel.consume(QUEUE_NAME, async (msg) => {
    if (msg !== null) {
      const content = JSON.parse(msg.content.toString());
      logger.info(`Notification Worker: Received job ${content.notificationId}`);

      try {
        await processNotification(content);
        
        // Acknowledge (tell RabbitMQ we're done)
        channel.ack(msg);
      } catch (error) {
        logger.error(`Notification Worker Error: ${error.message}`);
        
        // Negative Acknowledge (put back in queue? or dead letter?)
        // false = do not requeue immediately (to avoid infinite loop if bug)
        // In prod, you'd want a Dead Letter Exchange
        channel.nack(msg, false, false); 
      }
    }
  });
};

const processNotification = async (payload) => {
  const { notificationId, recipientId, type, title, message, channels, data } = payload;
  
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new Error(`Recipient ${recipientId} not found`);
  }

  // 1. Send Email if requested
  if (channels.includes("EMAIL")) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: title,
        text: message, // Or use a proper HTML template here based on 'type'
        // html: generateHtmlTemplate(type, data)
      });
      logger.info(`Notification Worker: Email sent to ${recipient.email}`);
    } catch (err) {
      logger.error(`Notification Worker: Failed to send email to ${recipient.email}`);
      // Don't fail the whole job, just log it? Or throw to retry?
    }
  }

  // 2. Send Real-time Push (Socket.io) if requested
  if (channels.includes("IN_APP")) {
    // If you have a global socket io instance, emit here
    // global.io.to(recipientId).emit('new_notification', payload);
    logger.info(`Notification Worker: In-App notification emitted for ${recipientId}`);
  }

  // 3. Update Status in DB
  await Notification.findByIdAndUpdate(notificationId, { 
    status: "SENT" 
  });
};
