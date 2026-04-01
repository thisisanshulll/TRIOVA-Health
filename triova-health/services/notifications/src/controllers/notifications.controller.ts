import { Request, Response } from 'express';
import { notificationsService } from '../services/notifications.service';
import { sendSuccess, sendError } from '../../../shared/utils/response';

export const notificationsController = {
  async getUserNotifications(req: Request, res: Response) {
    try {
      const { unread_only, limit } = req.query;
      const notifications = await notificationsService.getUserNotifications(
        req.user!.userId, 
        unread_only === 'true', 
        Number(limit) || 50
      );
      
      const counts = await notificationsService.getUnreadCount(req.user!.userId);
      return sendSuccess(res, { notifications, unread_count: counts.count });
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async markRead(req: Request, res: Response) {
    try {
      const isSelf = await notificationsService.isOwner(req.params.id, req.user!.userId);
      if (!isSelf) return sendError(res, 'Forbidden', 403);
      
      const notification = await notificationsService.markAsRead(req.params.id);
      return sendSuccess(res, notification);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async markAllRead(req: Request, res: Response) {
    try {
      const count = await notificationsService.markAllAsRead(req.user!.userId);
      return sendSuccess(res, { updated_count: count }, 'All notifications marked as read');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  },

  async deleteNotification(req: Request, res: Response) {
    try {
      const isSelf = await notificationsService.isOwner(req.params.id, req.user!.userId);
      if (!isSelf) return sendError(res, 'Forbidden', 403);
      
      await notificationsService.deleteNotification(req.params.id);
      return sendSuccess(res, null, 'Notification deleted');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }
};
