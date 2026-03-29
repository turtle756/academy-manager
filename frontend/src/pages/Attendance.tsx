import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Monitor, Hash, Hand } from 'lucide-react';
import api from '../lib/api';

interface Classroom {
  id: number;
  name: string;
}

interface SessionData {
  id: number;
  classroom_id: number;
  method: string;
  qr_code: string | null;
  pin_code: string | null;
  date: string;
  is_active: boolean;
}

interface AttendanceRecord {
  student_id: number;
  student_name: string;
  status: string;
  method: string;
  checked_at: string | null;
}

interface StudentInClass {
  student: { id: number; name: string };
}

const statusLabel: Record<string, string> = { present: '출석', late: '지각', absent: '결석', early_leave: '조퇴' };
const statusColor: Record<string, string> = { present: 'text-green-600', late: 'text-orange-500', absent: 'text-red-500', early_leave: 'text-purple-500' };

export default function Attendance() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [method, setMethod] = useState<'qr' | 'pin' | 'manual'>('qr');
  const [session, setSession] = useState<SessionData | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<{ id: number; name: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get('/classrooms').then(r => setClassrooms(r.data));
  }, []);

  useEffect(() => {
    if (selectedClassroom) {
      api.get('/classrooms').then(r => {
        const cr = r.data.find((c: any) => c.id === selectedClassroom);
        if (cr?.students) {
          setStudents(cr.students.map((sc: StudentInClass) => sc.student));
        }
      });
    }
  }, [selectedClassroom]);

  const startSession = async () => {
    if (!selectedClassroom) return;
    const res = await api.post('/attendance/sessions', {
      classroom_id: selectedClassroom,
      method,
    });
    setSession(res.data);
    loadRecords(res.data.id);
    connectWS(res.data.id);

    if (method === 'qr') {
      qrIntervalRef.current = setInterval(async () => {
        const r = await api.post(`/attendance/sessions/${res.data.id}/refresh-qr`);
        setSession(prev => prev ? { ...prev, qr_code: r.data.qr_code } : null);
      }, 30000);
    }
  };

  const loadRecords = async (sessionId: number) => {
    const res = await api.get(`/attendance/sessions/${sessionId}`);
    setRecords(res.data.attendances);
  };

  const connectWS = (sessionId: number) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/attendance/ws/${sessionId}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'check_in') {
        setRecords(prev => {
          const existing = prev.find(r => r.student_id === data.student_id);
          if (existing) return prev.map(r => r.student_id === data.student_id ? { ...r, status: data.status, method: data.method } : r);
          return [...prev, { student_id: data.student_id, student_name: data.student_name, status: data.status, method: data.method, checked_at: new Date().toISOString() }];
        });
      }
    };
    wsRef.current = ws;
  };

  const closeSession = async () => {
    if (!session) return;
    await api.post(`/attendance/sessions/${session.id}/close`);
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    if (wsRef.current) wsRef.current.close();
    setSession(null);
    setRecords([]);
  };

  const manualCheck = async (studentId: number, status: string) => {
    if (!session) return;
    await api.post(`/attendance/sessions/${session.id}/manual`, {
      student_id: studentId,
      status,
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">출결 관리</h2>

      {!session ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">반 선택</label>
            <select
              value={selectedClassroom || ''}
              onChange={e => setSelectedClassroom(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택하세요</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">출석 모드</label>
            <div className="flex gap-3">
              {[
                { key: 'qr' as const, icon: Monitor, label: 'QR코드' },
                { key: 'pin' as const, icon: Hash, label: 'PIN' },
                { key: 'manual' as const, icon: Hand, label: '수동' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors ${
                    method === m.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <m.icon size={18} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startSession}
            disabled={!selectedClassroom}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            출석 시작
          </button>
        </div>
      ) : (
        <div>
          {/* Active session */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  출석 진행중
                </span>
              </div>
              <button onClick={closeSession} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                출석 종료
              </button>
            </div>

            {/* QR display */}
            {session.method === 'qr' && session.qr_code && (
              <div className="flex flex-col items-center py-4">
                <QRCodeSVG value={`${window.location.origin}/check-in?qr=${session.qr_code}`} size={200} />
                <p className="text-sm text-gray-500 mt-3">30초마다 자동 갱신됩니다</p>
              </div>
            )}

            {/* PIN display */}
            {session.method === 'pin' && session.pin_code && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">출석 PIN</p>
                <p className="text-5xl font-bold tracking-widest text-gray-900">{session.pin_code}</p>
              </div>
            )}

            {/* Attendance count */}
            <p className="text-center text-gray-600 mt-4">
              출석: <span className="font-bold text-gray-900">{records.filter(r => r.status === 'present' || r.status === 'late').length}</span>
              /{students.length}명
            </p>
          </div>

          {/* Student list with status */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">시간</th>
                  <th className="px-4 py-3 font-medium text-gray-600">수동 처리</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const record = records.find(r => r.student_id === s.id);
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className={`px-4 py-3 font-medium ${record ? statusColor[record.status] : 'text-gray-400'}`}>
                        {record ? statusLabel[record.status] : '미체크'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {record?.checked_at ? new Date(record.checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center">
                          {['present', 'late', 'absent', 'early_leave'].map(st => (
                            <button
                              key={st}
                              onClick={() => manualCheck(s.id, st)}
                              className={`px-2 py-1 rounded text-xs border hover:bg-gray-50 ${record?.status === st ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
                            >
                              {statusLabel[st]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
