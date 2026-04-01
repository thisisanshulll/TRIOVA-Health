import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', notificationsController.getUserNotifications);
router.patch('/:id/read', notificationsController.markRead);
router.patch('/read-all', notificationsController.markAllRead);
router.delete('/:id', notificationsController.deleteNotification);

export { router as notificationRoutes };
