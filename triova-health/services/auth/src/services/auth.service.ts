import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../shared/db/pool';
import { logger } from '../../../shared/utils/logger';
import type { RegisterPatientDto, RegisterDoctorDto, TokenPair } from '../../../shared/types/auth.types';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

function generateTokenPair(payload: object): TokenPair {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as any);
  return { accessToken, refreshToken };
}

export const authService = {
  async registerPatient(dto: RegisterPatientDto) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
      const verificationToken = uuidv4();

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role, email_verification_token) 
         VALUES ($1, $2, 'patient', $3) RETURNING *`,
        [dto.email.toLowerCase(), passwordHash, verificationToken]
      );
      const user = userResult.rows[0];

      const patientResult = await client.query(
        `INSERT INTO patients (user_id, first_name, last_name, date_of_birth, gender, phone, preferred_language)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [user.id, dto.first_name, dto.last_name, dto.date_of_birth, dto.gender, dto.phone, dto.preferred_language || 'en']
      );
      const patient = patientResult.rows[0];

      const tokenPayload = { userId: user.id, role: 'patient', patientId: patient.id, email: user.email };
      const tokens = generateTokenPair(tokenPayload);

      await client.query(`UPDATE users SET refresh_token = $1 WHERE id = $2`, [tokens.refreshToken, user.id]);
      await client.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

      await client.query('COMMIT');

      return {
        user: { id: user.id, email: user.email, role: user.role, is_verified: user.is_verified },
        patient,
        tokens,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async registerDoctor(dto: RegisterDoctorDto) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
      const verificationToken = uuidv4();

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role, email_verification_token)
         VALUES ($1, $2, 'doctor', $3) RETURNING *`,
        [dto.email.toLowerCase(), passwordHash, verificationToken]
      );
      const user = userResult.rows[0];

      const doctorResult = await client.query(
        `INSERT INTO doctors (user_id, first_name, last_name, phone, specialization, license_number, qualification, experience_years)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [user.id, dto.first_name, dto.last_name, dto.phone, dto.specialization, dto.license_number, dto.qualification || null, dto.experience_years || null]
      );
      const doctor = doctorResult.rows[0];

      const tokenPayload = { userId: user.id, role: 'doctor', doctorId: doctor.id, email: user.email };
      const tokens = generateTokenPair(tokenPayload);

      await client.query(`UPDATE users SET refresh_token = $1 WHERE id = $2`, [tokens.refreshToken, user.id]);
      await client.query('COMMIT');

      return {
        user: { id: user.id, email: user.email, role: user.role },
        doctor,
        tokens,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async login(email: string, password: string) {
    const userResult = await pool.query(`SELECT * FROM users WHERE email = $1 AND is_active = TRUE`, [email.toLowerCase()]);
    if (!userResult.rows.length) throw new Error('Invalid email or password');

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) throw new Error('Invalid email or password');

    let profile = null;
    let patientId: string | undefined;
    let doctorId: string | undefined;

    if (user.role === 'patient') {
      const pResult = await pool.query(`SELECT * FROM patients WHERE user_id = $1`, [user.id]);
      profile = pResult.rows[0];
      patientId = profile?.id;
    } else if (user.role === 'doctor') {
      const dResult = await pool.query(`SELECT * FROM doctors WHERE user_id = $1`, [user.id]);
      profile = dResult.rows[0];
      doctorId = profile?.id;
    }

    const tokenPayload: any = { userId: user.id, role: user.role, email: user.email };
    if (patientId) tokenPayload.patientId = patientId;
    if (doctorId) tokenPayload.doctorId = doctorId;

    const tokens = generateTokenPair(tokenPayload);
    await pool.query(`UPDATE users SET refresh_token = $1, last_login_at = NOW() WHERE id = $2`, [tokens.refreshToken, user.id]);

    return {
      user: { id: user.id, email: user.email, role: user.role, is_verified: user.is_verified },
      role: user.role,
      profile,
      tokens,
    };
  },

  async logout(userId: string, _refreshToken?: string) {
    await pool.query(`UPDATE users SET refresh_token = NULL WHERE id = $1`, [userId]);
  },

  async refreshToken(token: string): Promise<TokenPair> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      throw new Error('Invalid refresh token');
    }

    const userResult = await pool.query(`SELECT * FROM users WHERE id = $1 AND refresh_token = $2`, [decoded.userId, token]);
    if (!userResult.rows.length) throw new Error('Token revoked or invalid');

    const user = userResult.rows[0];
    const payload: any = { userId: user.id, role: user.role, email: user.email };

    if (user.role === 'patient') {
      const p = await pool.query(`SELECT id FROM patients WHERE user_id = $1`, [user.id]);
      if (p.rows[0]) payload.patientId = p.rows[0].id;
    } else if (user.role === 'doctor') {
      const d = await pool.query(`SELECT id FROM doctors WHERE user_id = $1`, [user.id]);
      if (d.rows[0]) payload.doctorId = d.rows[0].id;
    }

    const tokens = generateTokenPair(payload);
    await pool.query(`UPDATE users SET refresh_token = $1 WHERE id = $2`, [tokens.refreshToken, user.id]);
    return tokens;
  },

  async forgotPassword(email: string) {
    const result = await pool.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (!result.rows.length) return; // Silent fail

    const resetToken = uuidv4();
    const expires = new Date(Date.now() + 1800000); // 30 minutes
    await pool.query(`UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3`, [
      resetToken, expires, email.toLowerCase()
    ]);

    logger.info(`Password reset token for ${email}: ${resetToken}`);
    // Email sending handled by notification service
  },

  async resetPassword(token: string, newPassword: string) {
    const result = await pool.query(
      `SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [token]
    );
    if (!result.rows.length) throw new Error('Invalid or expired reset token');

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, refresh_token = NULL WHERE id = $2`,
      [hash, result.rows[0].id]
    );
  },

  async verifyEmail(token: string) {
    const result = await pool.query(`UPDATE users SET is_verified = TRUE, email_verification_token = NULL WHERE email_verification_token = $1 RETURNING id`, [token]);
    if (!result.rows.length) throw new Error('Invalid verification token');
  },

  async resendVerification(email: string) {
    const token = uuidv4();
    await pool.query(`UPDATE users SET email_verification_token = $1 WHERE email = $2`, [token, email.toLowerCase()]);
    logger.info(`Verification token for ${email}: ${token}`);
  },

  async getProfile(userId: string, role: string) {
    const userResult = await pool.query(`SELECT id, email, role, is_verified, is_active, last_login_at, created_at FROM users WHERE id = $1`, [userId]);
    const user = userResult.rows[0];

    let profile = null;
    if (role === 'patient') {
      const p = await pool.query(`SELECT * FROM patients WHERE user_id = $1`, [userId]);
      profile = p.rows[0];
    } else if (role === 'doctor') {
      const d = await pool.query(`SELECT * FROM doctors WHERE user_id = $1`, [userId]);
      profile = d.rows[0];
    }

    return { user, profile };
  },
};
