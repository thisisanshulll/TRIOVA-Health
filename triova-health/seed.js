#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'triova_health',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
    });

async function seed() {
  console.log('🌱 Starting TRIOVA database seed...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clean existing
    await client.query('TRUNCATE TABLE users, patients, doctors, medical_documents, appointments, triage_sessions, wearable_data CASCADE');

    const pwHash = await bcrypt.hash('password123', 10);

    // 1. Create Admins
    await client.query(`
      INSERT INTO users (email, password_hash, role, is_active)
      VALUES ('admin@triova.health', $1, 'admin', true)
    `, [pwHash]);

    // 2. Create Doctors
    const docData = [
      { email: 'dr.smith@triova.health', fn: 'John', ln: 'Smith', spec: 'Cardiologist' },
      { email: 'dr.jones@triova.health', fn: 'Sarah', ln: 'Jones', spec: 'General Practice' }
    ];

    for (const d of docData) {
      const uRes = await client.query(`
        INSERT INTO users (email, password_hash, role, is_active)
        VALUES ($1, $2, 'doctor', true) RETURNING id
      `, [d.email, pwHash]);

      await client.query(`
        INSERT INTO doctors (user_id, first_name, last_name, phone, specialization, license_number, experience_years)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uRes.rows[0].id, 
        d.fn, 
        d.ln, 
        `+91 ${Math.floor(Math.random()*9000000000 + 1000000000)}`, 
        d.spec, 
        `LIC-${Math.floor(Math.random()*10000)}`, 
        8
      ]);
    }

    // 3. Create Patients
    const patientData = [
      { email: 'jdoe@example.com', fn: 'Jane', ln: 'Doe', dob: '1985-05-15', phone: '+91 9876543210' },
      { email: 'rroe@example.com', fn: 'Richard', ln: 'Roe', dob: '1990-08-22', phone: '+91 9876543211' }
    ];

    const patientIds = [];
    for (const p of patientData) {
      const uRes = await client.query(`
        INSERT INTO users (email, password_hash, role, is_active)
        VALUES ($1, $2, 'patient', true) RETURNING id
      `, [p.email, pwHash]);

      const pRes = await client.query(`
        INSERT INTO patients (user_id, first_name, last_name, date_of_birth, gender, phone)
        VALUES ($1, $2, $3, $4, 'female', $5) RETURNING id
      `, [uRes.rows[0].id, p.fn, p.ln, p.dob, p.phone]);
      patientIds.push(pRes.rows[0].id);
    }

    // 4. Create Wearable Data
    const janeId = patientIds[0];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now.getTime() - i * 3600000);
        await client.query(`
            INSERT INTO wearable_data (patient_id, recorded_at, heart_rate, spo2, blood_pressure_systolic, blood_pressure_diastolic, data_source)
            VALUES ($1, $2, $3, $4, 120, 80, 'mock')
        `, [janeId, timestamp, 70 + Math.floor(Math.random()*15), 96 + Math.floor(Math.random()*4)]);
    }

    await client.query('COMMIT');
    console.log('✅ Seed completed successfully!');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
