import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["WELCOME", "PASSWORD_RESET", "LOGIN_ALERT", "GENERAL", "TASK_ASSIGNED"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed, // For any extra payload (link, task_id, etc.)
    },
    channels: [{
      type: String,
      enum: ["EMAIL", "IN_APP", "PUSH", "SMS"], // Channels this notification should be sent to
    }],
    status: {
      type: String,
      enum: ["QUEUED", "SENT", "FAILED", "READ"],
      default: "QUEUED",
      index: true
    },
    retryCount: {
      type: Number,
      default: 0
    },
    readAt: {
      type: Date
    }
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
