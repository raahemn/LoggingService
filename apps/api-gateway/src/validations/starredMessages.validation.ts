import Joi from 'joi';

export const starredMessagesValidation = {
  // POST /starred-messages - Add a starred message
  addStarredMessage: {
    body: Joi.object({
      message: Joi.string()
        .trim()
        .min(1)
        .max(1000)
        .required()
        .label('Message'),
    }),
  },

  // DELETE /starred-messages - Remove a starred message
  removeStarredMessage: {
    body: Joi.object({
      message: Joi.string()
        .trim()
        .min(1)
        .max(1000)
        .required()
        .label('Message'),
    }),
  },
};
