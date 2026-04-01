import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, AlertTriangle } from 'lucide-react';

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get(`/analytics/doctor-dashboard/${user?.doctorId}`);
        setData(res.data.data);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user?.doctorId) fetchDashboard();
  }, [user]);

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;
  if (!data) return <div className="p-8 text-red-500">Failed to load dashboard data.</div>;

  const { metrics, today_appointments, urgent_triage_cases } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dr. {user?.firstName} {user?.lastName}</h1>
          <p className="text-slate-500 mt-1">Overview of your clinic today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><Calendar size={24} /></div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Appointments Today</p>
              <h3 className="text-3xl font-bold text-slate-900">{metrics.total_today}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full"><Users size={24} /></div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Remaining to see</p>
              <h3 className="text-3xl font-bold text-slate-900">{metrics.remaining}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className={metrics.critical_alerts > 0 ? "border-red-200" : ""}>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className={`p-4 rounded-full ${metrics.critical_alerts > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Critical Patient Alerts</p>
              <h3 className={`text-3xl font-bold ${metrics.critical_alerts > 0 ? "text-red-600" : "text-emerald-600"}`}>{metrics.critical_alerts}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Your appointments sorted by time and urgency</CardDescription>
          </CardHeader>
          <CardContent>
            {today_appointments.length > 0 ? (
              <div className="space-y-4">
                {today_appointments.map((a: any) => (
                  <div key={a.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="font-semibold text-lg">{a.appointment_time.slice(0,5)} - {a.first_name} {a.last_name}</div>
                      <div className="text-sm text-slate-500 capitalize">Type: {a.appointment_type.replace('_', ' ')}</div>
                    </div>
                    <Badge variant={a.urgency === 'emergency' ? 'destructive' : a.urgency === 'high' ? 'destructive' : 'secondary'}>
                      {a.urgency}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No appointments scheduled for today.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="border-orange-200">
            <CardHeader className="bg-orange-50 pb-4 border-b border-orange-100">
              <CardTitle className="text-orange-900 flex items-center gap-2">
                <AlertTriangle size={20} /> Pending Urgent Triage Cases
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {urgent_triage_cases.length > 0 ? (
                <div className="space-y-4">
                   {urgent_triage_cases.map((c: any) => (
                    <div key={c.id} className="p-4 bg-white border border-orange-100 rounded-lg shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold">{c.first_name} {c.last_name}</span>
                        <Badge variant="destructive" className="uppercase">{c.urgency_level}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{c.ai_summary}</p>
                    </div>
                   ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No urgent AI triage cases pending review.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
