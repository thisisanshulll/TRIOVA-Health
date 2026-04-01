import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function WearableChart({ patientId }: { patientId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/wearables/history/${patientId}?days=7`);
        // Format dates for the chart
        const formatted = res.data.data.map((d: any) => ({
          ...d,
          time: new Date(d.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        }));
        setData(formatted);
      } catch (err) {
        console.error('Failed to fetch wearable history', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [patientId]);

  if (isLoading) return <div className="h-full flex items-center justify-center text-slate-400">Loading chart data...</div>;
  if (!data.length) return <div className="h-full flex items-center justify-center text-slate-400">No recent wearable data found.</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" domain={['auto', 'auto']} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#94a3b8" domain={[90, 100]} />
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="heart_rate" name="Heart Rate (bpm)" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
        <Line yAxisId="right" type="monotone" dataKey="spo2" name="Blood O2 (%)" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
