import { pool } from '../../../shared/db/pool';

export const availabilityService = {
  async getAvailableSlots(doctorId: string, date: string, _urgency?: string) {
    const dayOfWeek = new Date(date).getDay();
    const availResult = await pool.query(
      `SELECT * FROM doctor_availability WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
      [doctorId, dayOfWeek]
    );

    const slots: Array<{ time: string; is_available: boolean }> = [];

    for (const avail of availResult.rows) {
      let slotTime = avail.start_time as string;
      while (slotTime < avail.end_time) {
        const conflict = await pool.query(
          `SELECT id FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status NOT IN ('cancelled','no_show')`,
          [doctorId, date, slotTime]
        );
        const unavail = await pool.query(
          `SELECT id FROM doctor_unavailability WHERE doctor_id = $1 AND unavailable_date = $2 AND (is_full_day = TRUE OR (start_time <= $3 AND end_time > $3))`,
          [doctorId, date, slotTime]
        );
        slots.push({ time: slotTime, is_available: conflict.rows.length === 0 && unavail.rows.length === 0 });
        const [h, m] = slotTime.split(':').map(Number);
        const next = new Date(0, 0, 0, h, m + avail.slot_duration_minutes, 0);
        slotTime = `${next.getHours().toString().padStart(2, '0')}:${next.getMinutes().toString().padStart(2, '0')}:00`;
      }
    }
    return slots;
  },

  async getNextAvailableSlot(doctorId: string, fromDate?: string, _urgency?: string) {
    const startDate = fromDate || new Date().toISOString().split('T')[0];
    const result = await pool.query(`SELECT * FROM get_next_available_slot($1, $2::TIMESTAMP, 'routine')`, [doctorId, startDate]);
    return result.rows[0] || null;
  },

  async setAvailability(dto: any) {
    const result = await pool.query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dto.doctor_id, dto.day_of_week, dto.start_time, dto.end_time, dto.slot_duration_minutes || 30]
    );
    return result.rows[0];
  },

  async updateAvailability(id: string, dto: any) {
    const fields = Object.keys(dto).filter((k) => ['start_time','end_time','is_active','slot_duration_minutes'].includes(k));
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => dto[f]);
    const result = await pool.query(`UPDATE doctor_availability SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...values]);
    return result.rows[0];
  },

  async setUnavailability(dto: any) {
    const result = await pool.query(
      `INSERT INTO doctor_unavailability (doctor_id, unavailable_date, start_time, end_time, is_full_day, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dto.doctor_id, dto.date, dto.start_time || null, dto.end_time || null, dto.is_full_day || false, dto.reason || null]
    );
    return result.rows[0];
  },
};
