import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';

export default function AppointmentsList() {
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await api.get(`/appointments/patient/${user?.patientId}`);
      setAppointments(res.data.data.appointments);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load appointments.' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await api.get('/doctors');
      setDoctors(res.data.data.doctors);
    } catch (err) { }
  };

  const handleBook = async () => {
    if (!selectedDoc || !selectedDate) return;
    setIsBooking(true);
    try {
      // Find a slot naively for the demo (normally we'd query /slots first)
      await api.post('/appointments', {
        patient_id: user?.patientId,
        doctor_id: selectedDoc,
        appointment_date: selectedDate.toISOString().split('T')[0],
        appointment_time: '10:00:00', // Simplified for demo
        appointment_type: 'routine',
        notes: ''
      });
      toast({ title: 'Success', description: 'Appointment requested.' });
      fetchAppointments();
      setSelectedDoc('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Booking Failed', description: err.response?.data?.error });
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Appointments</h1>
          <p className="text-slate-500">Manage your upcoming and past consultations.</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
             <Button className="bg-indigo-600 hover:bg-indigo-700">Book Appointment</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Book a Consultation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Doctor</label>
                <select 
                  className="w-full p-2 border rounded-md" 
                  value={selectedDoc} 
                  onChange={(e: any) => setSelectedDoc(e.target.value)}

                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Date</label>
                <div className="border rounded-md p-2 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                    disabled={(date: any) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </div>
              </div>
              <Button onClick={handleBook} disabled={isBooking || !selectedDoc || !selectedDate} className="w-full">
                {isBooking ? 'Booking...' : 'Confirm Request (10:00 AM Slot)'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div>Loading...</div>
        ) : appointments.length > 0 ? (
          appointments.map((a: any) => (

            <Card key={a.id}>
              <CardContent className="flex justify-between items-center p-6">
                <div>
                  <h3 className="text-xl font-semibold">Dr. {a.doc_fn} {a.doc_ln}</h3>
                  <p className="text-slate-500">{new Date(a.appointment_date).toLocaleDateString()} at {a.appointment_time}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <Badge variant={a.status === 'scheduled' ? 'default' : 'secondary'} className="uppercase">
                    {a.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{a.appointment_type.replace('_',' ')}</Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-slate-500">No appointments found.</p>
        )}
      </div>
    </div>
  );
}
