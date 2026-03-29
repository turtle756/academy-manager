import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, CreditCard, AlertTriangle, Clock } from 'lucide-react';
import api from '../lib/api';

interface DashboardData {
  today_attendance: { present: number; total: number; rate: number };
  month_attendance_rate: number;
  unpaid: { count: number; amount: number };
}

interface AtRisk {
  student_id: number;
  student_name: string;
  attendance_rate: number;
  total_classes: number;
}

interface Schedule {
  id: number;
  classroom_name: string;
  teacher_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
}

const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    api.get('/stats/dashboard').then(r => setStats(r.data)).catch(() => {});
    api.get('/stats/at-risk').then(r => setAtRisk(r.data)).catch(() => {});
    api.get('/schedules').then(r => {
      setSchedules(r.data.filter((s: Schedule) => s.day_of_week === todayKey));
    }).catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><UserCheck size={20} className="text-blue-600" /></div>
            <span className="text-sm text-gray-500">오늘 출석</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats ? `${stats.today_attendance.present}/${stats.today_attendance.total}명` : '-'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {stats ? `${stats.today_attendance.rate}%` : ''}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg"><Clock size={20} className="text-green-600" /></div>
            <span className="text-sm text-gray-500">이번달 출석률</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats ? `${stats.month_attendance_rate}%` : '-'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-lg"><CreditCard size={20} className="text-red-600" /></div>
            <span className="text-sm text-gray-500">미납</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats ? `${stats.unpaid.count}건` : '-'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {stats ? `${stats.unpaid.amount.toLocaleString()}원` : ''}
          </p>
        </div>
      </div>

      {/* Today's schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">오늘 수업 일정</h3>
        {schedules.length === 0 ? (
          <p className="text-gray-500 text-sm">오늘은 수업이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-gray-600">{s.start_time}~{s.end_time}</span>
                  <span className="font-medium text-gray-900">{s.classroom_name}</span>
                  <span className="text-sm text-gray-500">{s.teacher_name || '-'}</span>
                  <span className="text-sm text-gray-400">{s.room || ''}</span>
                </div>
                <Link
                  to={`/attendance?classroom=${s.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  출석 시작
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* At risk students */}
      {atRisk.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            이탈 위험 학생
          </h3>
          <div className="space-y-2">
            {atRisk.map((s) => (
              <div key={s.student_id} className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded-lg">
                <span className="font-medium text-gray-900">{s.student_name}</span>
                <span className="text-sm text-orange-600">출석률 {s.attendance_rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
