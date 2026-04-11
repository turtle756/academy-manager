import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { UserX, CreditCard, MessageSquare, Users, ChevronRight, AlertTriangle, Send, BookOpen } from 'lucide-react';
import api from '../lib/api';

interface DashboardData {
  today_attendance: { present: number; absent: number; total: number; rate: number };
  month_attendance_rate: number;
  unpaid: { count: number; amount: number };
  today_counseling: number;
  total_students: number;
}

interface NLPResult {
  ok: boolean;
  message: string;
  hint?: string;
  chips?: string[];
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

const QUICK_CHIPS = ['오늘 출석 현황', '이번달 미납자', '예정된 상담', '재원생 몇 명?'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [nlpText, setNlpText] = useState('');
  const [nlpResult, setNlpResult] = useState<NLPResult | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/stats/dashboard').then(r => setStats(r.data)).catch(() => {});
    api.get('/stats/at-risk').then(r => setAtRisk(r.data)).catch(() => {});
    api.get('/schedules').then(r => {
      setSchedules(r.data.filter((s: Schedule) => s.day_of_week === todayKey));
    }).catch(() => {});
  }, []);

  const nlpSubmit = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setNlpText(t);
    setNlpLoading(true);
    setNlpResult(null);
    try {
      const res = await api.post('/nlp', { text: t });
      setNlpResult(res.data);
      // 출결/납부 처리 후 대시보드 새로고침
      if (res.data.ok && res.data.intent && ['attendance_set','payment_set'].includes(res.data.intent)) {
        api.get('/stats/dashboard').then(r => setStats(r.data)).catch(() => {});
      }
    } catch {
      setNlpResult({ ok: false, message: '오류가 발생했습니다.' });
    } finally {
      setNlpLoading(false);
    }
  };

  const loadHints = async () => {
    if (hints.length > 0) { setShowHints(v => !v); return; }
    try {
      const res = await api.get('/nlp/hints');
      setHints(res.data.categories);
      setShowHints(true);
    } catch {}
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-500 mt-1">{todayStr} ({todayLabel}요일)</p>
      </div>

      {/* NLP 입력창 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex gap-2 mb-3">
          <input
            ref={inputRef}
            value={nlpText}
            onChange={e => setNlpText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nlpSubmit(nlpText)}
            placeholder="무엇이든 물어보거나 처리하세요  예) 오늘 김민수 결석, 이번달 미납자"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            disabled={nlpLoading}
          />
          <button
            onClick={() => nlpSubmit(nlpText)}
            disabled={nlpLoading || !nlpText.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium"
          >
            <Send size={14} />
            {nlpLoading ? '처리 중...' : '실행'}
          </button>
        </div>

        {/* 결과 */}
        {nlpResult && (
          <div className={`px-3 py-2 rounded-lg text-sm mb-2 ${nlpResult.ok ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'}`}>
            {nlpResult.message}
            {nlpResult.hint && <span className="ml-2 opacity-60 text-xs">{nlpResult.hint}</span>}
          </div>
        )}

        {/* 빠른 칩 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_CHIPS.map(chip => (
            <button key={chip} onClick={() => nlpSubmit(chip)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 rounded-full text-xs transition-colors">
              {chip}
            </button>
          ))}
          <button onClick={loadHints}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <BookOpen size={12} />
            {showHints ? '가이드 닫기' : '사용 예시'}
          </button>
        </div>

        {/* 가이드 */}
        {showHints && hints.length > 0 && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3">
            {hints.map(cat => (
              <div key={cat.name}>
                <p className="text-xs font-semibold text-gray-500 mb-1">{cat.name}</p>
                <div className="flex flex-wrap gap-1">
                  {cat.examples.map((ex: string) => (
                    <button key={ex} onClick={() => { nlpSubmit(ex); setShowHints(false); }}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 rounded text-xs">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
