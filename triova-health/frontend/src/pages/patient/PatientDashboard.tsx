import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Heart, Moon, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import WearableChart from '../../components/WearableChart';

export default function PatientDashboard() {
  const { user, token } = useAuthStore();
  const { isConnected } = useSocket(token || undefined);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get(`/analytics/patient-dashboard/${user?.patientId}`);
        setData(res.data.data);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user?.patientId) fetchDashboard();
  }, [user]);

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;
  if (!data) return <div className="p-8 text-red-500">Failed to load dashboard data.</div>;

  const { latest_vitals, health_score, active_alerts, upcoming_appointments } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Welcome, {user?.firstName || 'Patient'}
          </h1>
          <p className="text-slate-500 mt-1">
            Realtime connection: {isConnected ? <span className="text-green-500">● Active</span> : <span className="text-red-500">● Offline</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 uppercase font-semibold tracking-wider">Overall Health Score</p>
          <div className="text-5xl font-black text-indigo-600">{health_score?.toFixed(0) || 100}</div>
        </div>
      </div>

      {active_alerts?.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
          <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
            <AlertTriangle className="h-5 w-5" /> Active Health Alerts
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {active_alerts.map((a: any) => (
              <li key={a.id} className="text-red-900">{a.alert_message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard title="Heart Rate" value={latest_vitals?.heart_rate || '--'} unit="bpm" icon={Heart} color="text-rose-500" />
        <VitalCard title="Blood Oxygen" value={latest_vitals?.spo2 || '--'} unit="%" icon={Activity} color="text-blue-500" />
        <VitalCard title="Blood Pressure" value={`${latest_vitals?.blood_pressure_systolic || '--'}/${latest_vitals?.blood_pressure_diastolic || '--'}`} unit="mmHg" icon={Activity} color="text-indigo-500" />
        <VitalCard title="Sleep" value={latest_vitals?.sleep_hours || '--'} unit="hrs" icon={Moon} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Vitals Trend (Last 7 Days)</CardTitle>
            <CardDescription>Continuous monitoring data from your connected wearables.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
             {user?.patientId && <WearableChart patientId={user.patientId} />}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card shadow-sm>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming_appointments?.length > 0 ? (
                <ul className="space-y-4">
                  {upcoming_appointments.map((a: any) => (
                    <li key={a.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="font-semibold">{new Date(a.appointment_date).toLocaleDateString()} at {a.appointment_time}</div>
                      <div className="text-sm text-slate-600">Dr. {a.doc_fn} {a.doc_ln} ({a.specialization})</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No upcoming appointments.</p>
              )}
              <Button asChild className="w-full mt-4" variant="outline">
                <Link to="/appointments">Book Appointment</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-indigo-900 text-lg">Not feeling well?</CardTitle>
              <CardDescription className="text-indigo-700">Start an AI triage session to evaluate your symptoms instantly.</CardDescription>
            </CardHeader>
            <CardContent>
               <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700">
                <Link to="/triage">Start AI Triage</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function VitalCard({ title, value, unit, icon: Icon, color }: any) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full bg-slate-50 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{title}</p>
              <h3 className="text-2xl font-bold">
                {value} <span className="text-sm font-normal text-slate-500">{unit}</span>
              </h3>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
