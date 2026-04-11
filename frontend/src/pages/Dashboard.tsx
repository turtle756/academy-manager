import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { UserX, CreditCard, MessageSquare, Users, ChevronRight, AlertTriangle, Send } from 'lucide-react';
import api from '../lib/api';

interface DashboardData {
  today_attendance: { present: number; absent: number; total: number; rate: number };
  month_attendance_rate: number;
  unpaid: { count: number; amount: number };
  today_counseling: number;
  total_students: number;
}

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  ok?: boolean;
  hint?: string;
}

interface PendingAction {
  type: 'ask_student_info';
  student_name: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/stats/dashboard').then(r => setStats(r.data)).catch(() => {});
    api.get('/stats/at-risk').then(r => setAtRisk(r.data)).catch(() => {});
    api.get('/schedules').then(r => {
      setSchedules(r.data.filter((s: Schedule) => s.day_of_week === todayKey));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 학생 등록 멀티턴: "고2, 010-1234-5678" 파싱
  const parseStudentInfo = (text: string) => {
    const gradeMatch = text.match(/[초중고][1-6]|[1-9]학년/);
    const phoneMatch = text.match(/0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/);
    return {
      grade: gradeMatch?.[0] ?? null,
      phone: phoneMatch?.[0].replace(/[-\s]/g, '-') ?? null,
    };
  };

  const nlpSubmit = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setNlpText('');
    setMessages(prev => [...prev, { role: 'user', text: t }]);
    setNlpLoading(true);

    // 멀티턴: 학생 등록 정보 입력 대기 중
    if (pendingAction?.type === 'ask_student_info') {
      const CANCEL_WORDS = ['취소', '그만', '아니', '됐어', 'cancel', '중단'];
      const isCancelled = CANCEL_WORDS.some(w => t.includes(w));

      if (isCancelled) {
        setPendingAction(null);
        setMessages(prev => [...prev, { role: 'bot', text: '등록을 취소했습니다.', ok: true }]);
        setNlpLoading(false);
        inputRef.current?.focus();
        return;
      }

      const { grade, phone } = parseStudentInfo(t);
      // grade나 phone이 전혀 없으면 무관한 입력으로 판단
      if (!grade && !phone) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: `학년과 연락처를 입력해주세요.\n예) 고2, 010-1234-5678\n(취소하려면 "취소"를 입력하세요)`,
          ok: false,
        }]);
        setNlpLoading(false);
        inputRef.current?.focus();
        return;
      }

      const name = pendingAction.student_name;
      try {
        await api.post('/students', { name, grade: grade ?? undefined, phone: phone ?? undefined });
        setPendingAction(null);
        setMessages(prev => [...prev, {
          role: 'bot',
          text: `'${name}' 학생을 등록했습니다.${grade ? ` (${grade})` : ''}${phone ? ` 연락처: ${phone}` : ''}\n원생 관리에서 추가 정보를 입력할 수 있습니다.`,
          ok: true,
        }]);
        api.get('/stats/dashboard').then(r => setStats(r.data)).catch(() => {});
      } catch {
        setMessages(prev => [...prev, { role: 'bot', text: '등록 중 오류가 발생했습니다.', ok: false }]);
      } finally {
        setNlpLoading(false);
        inputRef.current?.focus();
      }
      return;
    }

    try {
      const res = await api.post('/nlp', { text: t });
      const d = res.data;
      setMessages(prev => [...prev, {
        role: 'bot',
        text: d.message + (d.hint ? `\n${d.hint}` : ''),
        ok: d.ok === true,
      }]);
      // 학생 정보 추가 요청 대기
      if (d.action === 'ask_student_info') {
        setPendingAction({ type: 'ask_student_info', student_name: d.student_name });
      }
      if (d.ok === true && d.intent && ['attendance_set', 'payment_set'].includes(d.intent)) {
        api.get('/stats/dashboard').then(r => setStats(r.data)).catch(() => {});
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '오류가 발생했습니다.', ok: false }]);
    } finally {
      setNlpLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-500 mt-1">{todayStr} ({todayLabel}요일)</p>
      </div>

      {/* 채팅형 NLP */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6 flex flex-col" style={{ height: '280px' }}>
        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <p className="text-sm">자연어로 명령하거나 조회하세요</p>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {QUICK_CHIPS.map(chip => (
                  <button key={chip} onClick={() => nlpSubmit(chip)}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-500 rounded-full text-xs transition-colors">
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : msg.ok === false
                    ? 'bg-orange-50 text-orange-800 border border-orange-200 rounded-bl-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {nlpLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm text-sm text-gray-400">처리 중...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="border-t px-3 py-2.5 flex gap-2">
          {messages.length > 0 && (
            <div className="flex gap-1 mr-1">
              {QUICK_CHIPS.map(chip => (
                <button key={chip} onClick={() => nlpSubmit(chip)}
                  className="px-2 py-1 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-500 rounded-full text-xs hidden md:block">
                  {chip}
                </button>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            value={nlpText}
            onChange={e => setNlpText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !nlpLoading && nlpSubmit(nlpText)}
            placeholder={pendingAction?.type === 'ask_student_info'
              ? '예) 고2, 010-1234-5678  (학년·연락처를 입력하세요)'
              : '예) 오늘 김민수 결석, 이번달 미납자, 김기현 추가해줘'}
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            disabled={nlpLoading}
          />
          <button
            onClick={() => nlpSubmit(nlpText)}
            disabled={nlpLoading || !nlpText.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
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
