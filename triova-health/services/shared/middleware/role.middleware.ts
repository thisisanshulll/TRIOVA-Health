import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

// Track unauthorized attempts for flagging
const roleViolations: Map<string, { count: number; firstAt: Date }> = new Map();

export function roleMiddleware(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      const userId = req.user.userId;
      const now = new Date();
      const existing = roleViolations.get(userId);

      if (existing) {
        const minutesSince = (now.getTime() - existing.firstAt.getTime()) / 60000;
        if (minutesSince > 10) {
          roleViolations.set(userId, { count: 1, firstAt: now });
        } else {
          existing.count++;
          if (existing.count >= 5) {
            logger.warn('SECURITY: Repeated role violation attempts', {
              userId,
              endpoint: req.path,
              role: req.user.role,
              attempts: existing.count,
            });
          }
        }
      } else {
        roleViolations.set(userId, { count: 1, firstAt: now });
      }

      logger.warn('Role access violation', {
        userId: req.user.userId,
        actualRole: req.user.role,
        requiredRoles: allowedRoles,
        endpoint: req.path,
      });
      sendError(res, 'Forbidden: insufficient permissions', 403);
      return;
    }

    next();
  };
}
