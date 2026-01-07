import app from "./app.js";
import http from "http";
import logger from "./utils/logger.js";

import connectMongoDB from "./config/db.js";
import redisClient from "./config/redis.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { startNotificationWorker } from "./workers/notification.worker.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {
        connectMongoDB();

        redisClient.on("connect", () => {
            logger.info(
              `Connected to Redis at ${redisClient.options.host}:${redisClient.options.port}`,
            );
        })
        
        redisClient.on("error", (error) => {
            logger.error(`Redis Client Error: ${error.message}`);
        });

        // 3. Start Background Workers
        await connectRabbitMQ();
        startNotificationWorker();
        // runActivityWorker(); 

        const server = http.createServer(app);

        server.listen(PORT, () => {
            logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });

        // Handle Unhandled Rejections
        process.on("unhandledRejection", (err) => {
            logger.error(`Error: ${err.message}`);
            server.close(() => process.exit(1));
        });

    } catch (error) {
        logger.error(`❌ Failed to start server: ${error.message}`);
        process.exit(1);
    }
};

startServer();
