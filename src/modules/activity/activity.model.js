import mongoose, { Schema } from "mongoose";

const ActivityLogSchema = new Schema({
  actor_id: {
    type: String,
    index: true
  },
  actor_type: {
    type: String,
    enum: ["User", "Admin", "System"],
    default: "User"
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  module: {
    type: String,
    required: true,
    index: true
  },
  target_type: String,
  target_id: String,

  before: Object,
  after: Object,

  context: {
    ip: String,
    userAgent: String,
    requestId: String,
    path: String,
    method: String
  },

  occurred_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  strict: true,
});

// Add TTL index for automatic deletion (e.g., 30 days)
ActivityLogSchema.index({ occurred_at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema);

export default ActivityLog;
