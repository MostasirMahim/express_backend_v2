import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String, // e.g., 'user_create', 'user_delete'
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    module: {
      type: String, // To categorize permissions (e.g., 'Auth', 'User', 'Settings')
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String, // e.g., 'admin', 'manager'
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Permission = mongoose.model("Permission", permissionSchema);
const Role = mongoose.model("Role", roleSchema);

export { Permission, Role };
