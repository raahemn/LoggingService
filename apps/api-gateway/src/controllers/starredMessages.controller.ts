import { NextFunction, Request, Response } from 'express';
import createResponse from "../utils/responseHelper";
import { starredMessagesService } from '../services';

export const getStarredMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json(
        createResponse(401, 'User not authenticated', null)
      );
      return;
    }

    const starredMessages = await starredMessagesService.getStarredMessages(userId);

    res.status(200).json(
      createResponse(200, 'Starred messages fetched successfully', starredMessages)
    );
  } catch (error) {
    next(error);
  }
};

export const addStarredMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { message } = req.body;

    if (!userId) {
      res.status(401).json(
        createResponse(401, 'User not authenticated', null)
      );
      return;
    }

    if (!message) {
      res.status(400).json(
        createResponse(400, 'Message is required', null)
      );
      return;
    }

    const starredMessages = await starredMessagesService.addStarredMessage(userId, message);

    res.status(200).json(
      createResponse(200, 'Message starred successfully', starredMessages)
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Message is already starred') {
      res.status(409).json(
        createResponse(409, 'Message is already starred', null)
      );
      return;
    }
    next(error);
  }
};

export const removeStarredMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { message } = req.body;

    if (!userId) {
      res.status(401).json(
        createResponse(401, 'User not authenticated', null)
      );
      return;
    }

    if (!message) {
      res.status(400).json(
        createResponse(400, 'Message is required', null)
      );
      return;
    }

    const starredMessages = await starredMessagesService.removeStarredMessage(userId, message);

    res.status(200).json(
      createResponse(200, 'Message unstarred successfully', starredMessages)
    );
  } catch (error) {
    next(error);
  }
};
