import { pool } from '../../../shared/db/pool';

export const notificationsService = {
  async getUserNotifications(userId: string, unreadOnly: boolean, limit: number) {
    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const values: any[] = [userId];

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $2`;
    values.push(limit);

    const r = await pool.query(query, values);
    return r.rows;
  },

  async getUnreadCount(userId: string) {
    const r = await pool.query(`SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`, [userId]);
    return r.rows[0];
  },

  async markAsRead(notificationId: string) {
    const r = await pool.query(`UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`, [notificationId]);
    return r.rows[0];
  },

  async markAllAsRead(userId: string) {
    const r = await pool.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [userId]);
    return r.rowCount;
  },

  async isOwner(notificationId: string, userId: string) {
    const r = await pool.query(`SELECT id FROM notifications WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
    return r.rows.length > 0;
  },

  async deleteNotification(notificationId: string) {
    await pool.query(`DELETE FROM notifications WHERE id = $1`, [notificationId]);
  },

  async createNotification(userId: string, type: string, title: string, message: string, priority: string = 'normal', data: any = {}) {
    const r = await pool.query(
      `INSERT INTO notifications (user_id, notification_type, title, message, priority, related_entity_id, related_entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, type, title, message, priority, data.entityId || null, data.entityType || null]
    );
    return r.rows[0];
  }
};
