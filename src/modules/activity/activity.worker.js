import { getChannel } from "../../config/rabbitmq.js";
import ActivityLog from "./activity.model.js";
import logger from "../../utils/logger.js";

const ACTIVITY_QUEUE = "activity_queue";

export const runActivityWorker = async () => {
  try {
    const channel = getChannel();
    if (!channel) {
      logger.warn("RabbitMQ channel not available for Activity Worker. Retrying in 5s...");
      setTimeout(runActivityWorker, 5000);
      return;
    }

    logger.info("Activity Worker Started...");

    await channel.assertQueue(ACTIVITY_QUEUE, { durable: true });

    channel.consume(ACTIVITY_QUEUE, async (msg) => {
      if (msg !== null) {
        try {
          const activityData = JSON.parse(msg.content.toString());
          
          await ActivityLog.create(activityData);

          channel.ack(msg);
        } catch (error) {
          logger.error(`Error processing activity log: ${error.message}`);
          // If error is persistent (e.g. valid JSON but schema mismatch), we might wnat to ack or nack
          // For now, nack without requeue to avoid infinite loops if it's a data issue? 
          // Or just ack to discard. Let's nack(false) to dead letter if configured, or just standard nack.
          // Given simplicity, logging and acking (to drop bad message) is often safer preventing queue clogging, 
          // but strictly we should nack(false).
          channel.nack(msg, false, false); 
        }
      }
    });
  } catch (error) {
    logger.error(`Activity Worker Error: ${error.message}`);
  }
};
