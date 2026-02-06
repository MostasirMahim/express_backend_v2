import Joi from "joi";

// Helper for ObjectId validation
const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid MongoId');
  }
  return value;
};

export const validateMediaId = (data) => {
  const schema = Joi.object({
    id: Joi.string().custom(objectId).required(),
  });
  return schema.validate(data);
};

// If we add metadata upload later (e.g. caption, altText)
export const validateUploadMetadata = (data) => {
  const schema = Joi.object({
     description: Joi.string().max(500).optional(),
     altText: Joi.string().max(100).optional()
  });
  return schema.validate(data);
};
