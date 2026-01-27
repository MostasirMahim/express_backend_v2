import amqp from "amqplib";
import { env } from "./env.js";
import logger from "../utils/logger.js";

let connection = null;
let channel = null;

const QUEUE_NAME = "notifications_queue";
const EXCHANGE_NAME = "notifications_exchange";

export const connectRabbitMQ = async () => {
  try {
    // Check if we need to mock for development without a real RabbitMQ server
    if (env.RABBITMQ_URL === 'mock') {
        logger.warn("RabbitMQ URL set to 'mock'. Skipping connection.");
        return null;
    }

    connection = await amqp.connect(env.RABBITMQ_URL || "amqp://localhost");
    channel = await connection.createChannel();

    // Setup Exchange and Queue
    await channel.assertExchange(EXCHANGE_NAME, "direct", { durable: true });
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, "notification");

    logger.info("RabbitMQ Connected Successfully");
    return channel;
  } catch (error) {
    logger.error(`RabbitMQ Connection Error: ${error.message}`);
    // Retry logic could go here
    return null;
  }
};

export const getChannel = () => channel;

export const publishMessage = async (routingKey, message) => {
  if (!channel) {
    logger.error("RabbitMQ channel not initialized");
    return false;
  }

  try {
    await channel.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
    return true;
  } catch (error) {
    logger.error(`Error publishing message: ${error.message}`);
    return false;
  }
};

export default {
  connectRabbitMQ,
  getChannel,
  publishMessage
};
