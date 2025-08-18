import User from '../models/User.model'

export const getStarredMessages = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user.starredMessages || [];
};

export const addStarredMessage = async (userId: string, message: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if message is already starred
  if (user.starredMessages.includes(message)) {
    // no need to throw an error here, just return the current starred messages
    return user.starredMessages;
  }

  user.starredMessages.push(message);
  await user.save();
  return user.starredMessages;
};

export const removeStarredMessage = async (userId: string, message: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  user.starredMessages = user.starredMessages.filter(msg => msg !== message);
  await user.save();
  return user.starredMessages;
};
