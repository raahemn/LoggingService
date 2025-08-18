import express, { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth';
import validate from '../middlewares/validate';
import { starredMessagesController } from '../controllers';
import { starredMessagesValidation } from '../validations/starredMessages.validation';

const router: Router = express.Router();

// Apply authentication to all starred messages routes
router.use(authenticateJWT);

router
  .route('/')
  .get(starredMessagesController.getStarredMessages)
  .post(
    validate(starredMessagesValidation.addStarredMessage),
    starredMessagesController.addStarredMessage
  )
  .delete(
    validate(starredMessagesValidation.removeStarredMessage),
    starredMessagesController.removeStarredMessage
  );

export default router;
