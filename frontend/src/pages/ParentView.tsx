import { useState } from 'react';
import api from '../lib/api';

interface StudentInfo { id: number; name: string; academy_id: number }
interface AttRecord { date: string; status: string; checked_at: string }
interface AttData { student_name: string; records: AttRecord[]; summary: { present: number; late: number; absent: number; rate: number } }
interface GradeData { exam_name: string; score: number; total_score: number; date: string }
interface InvData { id: number; amount: number; description: string; status: string; due_date: string; paid_date: string | null }

const statusLabel: Record<string, string> = { present: '출석', late: '지각', absent: '결석', early_leave: '조퇴' };
const statusBg: Record<string, string> = { present: 'bg-green-500', late: 'bg-orange-400', absent: 'bg-red-500', early_leave: 'bg-purple-400' };

export default function ParentView() {
  const [phone, setPhone] = useState('');
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selected, setSelected] = useState<StudentInfo | null>(null);
  const [tab, setTab] = useState<'att' | 'grade' | 'pay'>('att');
  const [attendance, setAttendance] = useState<AttData | null>(null);
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [invoices, setInvoices] = useState<InvData[]>([]);
  const [error, setError] = useState('');

  const verify = async () => {
    try {
      const res = await api.post('/parent/verify', { phone });
      setStudents(res.data);
      setError('');
      if (res.data.length === 1) selectStudent(res.data[0]);
    } catch { setError('등록된 학생이 없습니다'); }
  };

  const selectStudent = async (s: StudentInfo) => {
    setSelected(s);
    const [att, gr, inv] = await Promise.all([
      api.get(`/parent/attendance/${s.id}?phone=${phone}`),
      api.get(`/parent/grades/${s.id}?phone=${phone}`),
      api.get(`/parent/invoices/${s.id}?phone=${phone}`),
    ]);
    setAttendance(att.data);
    setGrades(gr.data);
    setInvoices(inv.data);
  };

  if (!selected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
          <h1 className="text-xl font-bold mb-2">학부모 조회</h1>
          <p className="text-sm text-gray-500 mb-6">등록된 전화번호를 입력해주세요</p>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full px-4 py-3 border rounded-xl text-center text-lg outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button onClick={verify} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">확인</button>

          {students.length > 1 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-500">자녀를 선택하세요</p>
              {students.map(s => (
                <button key={s.id} onClick={() => selectStudent(s)} className="w-full py-2 border rounded-lg hover:bg-gray-50">{s.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <div className="bg-white rounded-2xl p-5 shadow mb-4">
        <h2 className="text-lg font-bold">{selected.name} 학생</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 mb-4 shadow">
        {([['att', '출결'], ['grade', '성적'], ['pay', '납부']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Attendance tab */}
      {tab === 'att' && attendance && (
        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center"><p className="text-2xl font-bold text-green-600">{attendance.summary.present}</p><p className="text-xs text-gray-500">출석</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-orange-500">{attendance.summary.late}</p><p className="text-xs text-gray-500">지각</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-red-500">{attendance.summary.absent}</p><p className="text-xs text-gray-500">결석</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-blue-600">{attendance.summary.rate}%</p><p className="text-xs text-gray-500">출석률</p></div>
          </div>
          <div className="space-y-1.5">
            {attendance.records.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{r.date}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs text-white ${statusBg[r.status]}`}>{statusLabel[r.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grades tab */}
      {tab === 'grade' && (
        <div className="bg-white rounded-2xl p-5 shadow">
          {grades.length === 0 ? <p className="text-gray-500 text-center">성적 기록이 없습니다</p> : (
            <div className="space-y-2">
              {grades.map((g, i) => (
                <div key={i} className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{g.exam_name}</p>
                    <p className="text-xs text-gray-400">{g.date}</p>
                  </div>
                  <p className="text-lg font-bold">{g.score}<span className="text-sm text-gray-400">/{g.total_score}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment tab */}
      {tab === 'pay' && (
        <div className="bg-white rounded-2xl p-5 shadow">
          {invoices.length === 0 ? <p className="text-gray-500 text-center">납부 내역이 없습니다</p> : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{inv.description || '학원비'}</p>
                    <p className="text-xs text-gray-400">{inv.due_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{inv.amount.toLocaleString()}원</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {inv.status === 'paid' ? '납부' : '미납'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
