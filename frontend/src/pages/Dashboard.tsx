import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserX, CreditCard, MessageSquare, Users, ChevronRight, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

interface DashboardData {
  today_attendance: { present: number; absent: number; total: number; rate: number };
  month_attendance_rate: number;
  unpaid: { count: number; amount: number };
  today_counseling: number;
  total_students: number;
}

interface AtRisk {
  student_id: number;
  student_name: string;
  attendance_rate: number;
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
const todayLabel = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
const todayStr = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-500 mt-1">{todayStr} ({todayLabel}요일)</p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Link to="/attendance" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-50 rounded-lg"><UserX size={18} className="text-red-500" /></div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats ? `${stats.today_attendance.absent}명` : '-'}
          </p>
          <p className="text-xs text-gray-500 mt-1">오늘 결석</p>
          {stats && stats.today_attendance.total > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              전체 {stats.today_attendance.total}명 중
            </p>
          )}
        </Link>

        <Link to="/payments" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-50 rounded-lg"><CreditCard size={18} className="text-orange-500" /></div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats ? `${stats.unpaid.count}건` : '-'}
          </p>
          <p className="text-xs text-gray-500 mt-1">미납</p>
          {stats && stats.unpaid.amount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.unpaid.amount.toLocaleString()}원
            </p>
          )}
        </Link>

        <Link to="/counseling" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 rounded-lg"><MessageSquare size={18} className="text-purple-500" /></div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats ? `${stats.today_counseling}건` : '-'}
          </p>
          <p className="text-xs text-gray-500 mt-1">오늘 상담</p>
        </Link>

        <Link to="/students" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Users size={18} className="text-blue-500" /></div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats ? `${stats.total_students}명` : '-'}
          </p>
          <p className="text-xs text-gray-500 mt-1">재원생</p>
        </Link>
      </div>

      {/* Today's schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">오늘 수업</h3>
          <Link to="/schedules" className="text-xs text-blue-600 hover:text-blue-800">전체 보기</Link>
        </div>
        {schedules.length === 0 ? (
          <p className="text-sm text-gray-400">오늘은 수업이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500 w-20">{s.start_time}–{s.end_time}</span>
                  <span className="font-medium text-gray-900 text-sm">{s.classroom_name}</span>
                  {s.teacher_name && <span className="text-xs text-gray-400">{s.teacher_name}</span>}
                  {s.room && <span className="text-xs text-gray-400">{s.room}</span>}
                </div>
                <Link to={`/attendance?classroom=${s.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  출석 →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* At-risk students */}
      {atRisk.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            출석 위험 학생 <span className="text-sm font-normal text-gray-400">(최근 30일 80% 미만)</span>
          </h3>
          <div className="space-y-1.5">
            {atRisk.slice(0, 5).map((s) => (
              <div key={s.student_id} className="flex items-center justify-between py-1.5 px-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium text-gray-900">{s.student_name}</span>
                <span className="text-sm text-orange-600 font-medium">{s.attendance_rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
