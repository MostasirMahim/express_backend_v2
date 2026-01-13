import mongoose, { Schema } from "mongoose";
import { Role, Permission } from "../rbac/rbac.model.js";

const tokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tokenHash: { type: String, index: true },
    ip: String,
    userAgent: String,
    usedAt: Date,
    revokedAt: Date,
    expiresAt: { type: Date, index: { expires: 0 } }, // auto-delete expired tokens
  },
  { timestamps: true },
);

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: 7 * 24 * 60 * 60 },
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
  },
  {
    timestamps: true,
  },
);

userSchema.index({ username: "text" });

const User = mongoose.model("User", userSchema);
const Token = mongoose.model("Token", tokenSchema);

export { User, Token };
