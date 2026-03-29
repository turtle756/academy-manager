import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/api';

interface Trend { month: string; rate: number }
interface AtRisk { student_id: number; student_name: string; attendance_rate: number }

export default function Stats() {
  const [trend, setTrend] = useState<Trend[]>([]);
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);

  useEffect(() => {
    api.get('/stats/attendance-trend').then(r => setTrend(r.data)).catch(() => {});
    api.get('/stats/at-risk').then(r => setAtRisk(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">통계</h2>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">출석률 추이 (최근 6개월)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4">이탈 위험 학생 (출석률 80% 미만)</h3>
        {atRisk.length === 0 ? (
          <p className="text-gray-500 text-sm">이탈 위험 학생이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {atRisk.map(s => (
              <div key={s.student_id} className="flex items-center justify-between py-3 px-4 bg-orange-50 rounded-lg">
                <span className="font-medium">{s.student_name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${s.attendance_rate}%` }} />
                  </div>
                  <span className="text-sm font-mono text-orange-600 w-12 text-right">{s.attendance_rate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
