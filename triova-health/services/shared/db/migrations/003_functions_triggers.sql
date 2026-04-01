-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patient_medications_updated_at BEFORE UPDATE ON patient_medications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medical_documents_updated_at BEFORE UPDATE ON medical_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_baseline_metrics_updated_at BEFORE UPDATE ON baseline_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get next available slot for a doctor
CREATE OR REPLACE FUNCTION get_next_available_slot(
    p_doctor_id UUID,
    p_from_datetime TIMESTAMP,
    p_urgency urgency_level
) RETURNS TABLE(slot_date DATE, slot_time TIME) AS $$
DECLARE
    check_date DATE;
    day_num INT;
    avail_record RECORD;
    slot_start TIME;
BEGIN
    check_date := p_from_datetime::DATE;

    FOR i IN 0..30 LOOP
        day_num := EXTRACT(DOW FROM check_date);

        FOR avail_record IN
            SELECT * FROM doctor_availability
            WHERE doctor_id = p_doctor_id
            AND day_of_week = day_num
            AND is_active = TRUE
        LOOP
            slot_start := avail_record.start_time;

            WHILE slot_start < avail_record.end_time LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM appointments
                    WHERE doctor_id = p_doctor_id
                    AND appointment_date = check_date
                    AND appointment_time = slot_start
                    AND status NOT IN ('cancelled', 'no_show')
                ) AND NOT EXISTS (
                    SELECT 1 FROM doctor_unavailability
                    WHERE doctor_id = p_doctor_id
                    AND unavailable_date = check_date
                    AND (is_full_day = TRUE OR (start_time <= slot_start AND end_time > slot_start))
                ) THEN
                    slot_date := check_date;
                    slot_time := slot_start;
                    RETURN NEXT;
                    RETURN;
                END IF;

                slot_start := slot_start + (avail_record.slot_duration_minutes || ' minutes')::INTERVAL;
            END LOOP;
        END LOOP;

        check_date := check_date + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
