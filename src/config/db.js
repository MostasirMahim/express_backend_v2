import mongoose from "mongoose";
import logger from "../utils/logger.js";
const connectMongoDB = async () => {
  try {
    const connect = await mongoose.connect(process.env.MONGO_URI);
    logger.info(
      `Connected to MongoDB at ${connect.connection.host}:${connect.connection.port}`,
    );
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`, error);
    process.exit(1);
  }
};

export default connectMongoDB;
