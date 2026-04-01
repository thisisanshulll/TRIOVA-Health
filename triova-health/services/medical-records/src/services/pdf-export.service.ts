import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { pool } from '../../../shared/db/pool';

export async function exportMedicalHistory(patientId: string, res: Response) {
  const [patient, allergies, conditions, medications, triage, consultations] = await Promise.all([
    pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]),
    pool.query(`SELECT * FROM patient_allergies WHERE patient_id = $1`, [patientId]),
    pool.query(`SELECT * FROM patient_chronic_conditions WHERE patient_id = $1`, [patientId]),
    pool.query(`SELECT * FROM patient_medications WHERE patient_id = $1 ORDER BY is_active DESC, created_at DESC`, [patientId]),
    pool.query(`SELECT * FROM triage_sessions WHERE patient_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 10`, [patientId]),
    pool.query(`SELECT c.*, d.first_name || ' ' || d.last_name as doctor_name FROM consultations c JOIN doctors d ON c.doctor_id = d.id WHERE c.patient_id = $1 ORDER BY c.created_at DESC LIMIT 10`, [patientId]),
  ]);

  if (!patient.rows.length) throw new Error('Patient not found');
  const p = patient.rows[0];

  const doc = new PDFDocument({ margin: 50, info: { Title: `Medical Record - ${p.first_name} ${p.last_name}`, Author: 'TRIOVA Health' } });

  res.setHeader('Content-disposition', `attachment; filename="medical_record_${p.first_name}_${p.last_name}_${new Date().toISOString().split('T')[0]}.pdf"`);
  res.setHeader('Content-type', 'application/pdf');
  doc.pipe(res);

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('TRIOVA Health Platform', { align: 'center' });
  doc.fontSize(16).text('Complete Medical Record', { align: 'center' });
  doc.moveDown(2);

  // Patient Info
  doc.fontSize(14).text('Patient Information').moveDown(0.5);
  doc.fontSize(10).font('Helvetica')
     .text(`Name: ${p.first_name} ${p.last_name}`)
     .text(`DOB: ${p.date_of_birth} | Gender: ${p.gender}`)
     .text(`Blood Group: ${p.blood_group || 'N/A'}`)
     .text(`Height: ${p.height_cm ? p.height_cm + ' cm' : 'N/A'} | Weight: ${p.weight_kg ? p.weight_kg + ' kg' : 'N/A'}`)
     .text(`Emergency Contact: ${p.emergency_contact_name || 'N/A'} (${p.emergency_contact_phone || 'N/A'})`);
  doc.moveDown(2);

  // Allergies
  doc.fontSize(14).font('Helvetica-Bold').text('Allergies').moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  if (allergies.rows.length) {
    allergies.rows.forEach(a => doc.text(`• ${a.allergen} (${a.severity.toUpperCase()}): ${a.reaction_description || 'No description'}`));
  } else doc.text('No known allergies');
  doc.moveDown(2);

  // Conditions
  doc.fontSize(14).font('Helvetica-Bold').text('Chronic Conditions').moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  if (conditions.rows.length) {
    conditions.rows.forEach(c => doc.text(`• ${c.condition_name} (Since: ${c.diagnosed_date || 'Unknown'}) - ${c.notes || ''}`));
  } else doc.text('No known chronic conditions');
  doc.moveDown(2);

  // Medications
  doc.fontSize(14).font('Helvetica-Bold').text('Medications').moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  if (medications.rows.length) {
    medications.rows.forEach(m => doc.text(`• [${m.is_active ? 'ACTIVE' : 'INACTIVE'}] ${m.medication_name} - ${m.dosage || ''} ${m.frequency || ''} (${m.timing_instructions || ''})`));
  } else doc.text('No recorded medications');
  doc.moveDown(2);

  // Recent Triage
  doc.addPage();
  doc.fontSize(14).font('Helvetica-Bold').text('Recent AI Triage Summaries').moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  if (triage.rows.length) {
    triage.rows.forEach(t => {
      doc.font('Helvetica-Bold').text(`${new Date(t.created_at).toLocaleDateString()} - Urgency: ${t.urgency_level}`);
      doc.font('Helvetica').text(`Complaint: ${t.chief_complaint}`);
      doc.text(`AI Summary: ${t.ai_summary}`);
      doc.moveDown(1);
    });
  } else doc.text('No triage history found');
  doc.moveDown(2);

  // Consultations
  doc.addPage();
  doc.fontSize(14).font('Helvetica-Bold').text('Recent Consultations').moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  if (consultations.rows.length) {
    consultations.rows.forEach(c => {
      doc.font('Helvetica-Bold').text(`${new Date(c.created_at).toLocaleDateString()} - Dr. ${c.doctor_name}`);
      doc.font('Helvetica').text(`Diagnosis: ${c.diagnosis || 'N/A'}`);
      doc.text(`Symptoms: ${c.symptoms || 'N/A'}`);
      doc.text(`Doctor Notes: ${c.consultation_notes || 'N/A'}`);
      doc.moveDown(1);
    });
  } else doc.text('No consultation history found');

  // Footer footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).text(`Page ${i + 1} of ${pages.count} - Generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 50, { align: 'center' });
  }

  doc.end();
}
