import { format, addMinutes, parseISO, isAfter, isBefore, differenceInMinutes } from 'date-fns';

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, "yyyy-MM-dd'T'HH:mm:ss");
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm:ss');
}

export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  const newDate = addMinutes(date, minutes);
  return format(newDate, 'HH:mm:ss');
}

export function isTimeAfter(time1: string, time2: string): boolean {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return h1 * 60 + m1 > h2 * 60 + m2;
}

export function isTimeBefore(time1: string, time2: string): boolean {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return h1 * 60 + m1 < h2 * 60 + m2;
}

export function getDayOfWeek(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getDay();
}

export function minutesBetween(dt1: Date, dt2: Date): number {
  return Math.abs(differenceInMinutes(dt1, dt2));
}

export function isPast2HoursBefore(appointmentDate: string, appointmentTime: string): boolean {
  const apptDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
  const now = new Date();
  const diffMinutes = differenceInMinutes(apptDateTime, now);
  return diffMinutes < 120;
}
