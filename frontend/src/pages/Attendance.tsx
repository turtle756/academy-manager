import { useEffect, useState } from 'react';
import { Check, Clock, X, LogOut as EarlyLeave } from 'lucide-react';
import api from '../lib/api';

interface Classroom {
  id: number;
  name: string;
  students?: { student: { id: number; name: string } }[];
}

interface Student {
  id: number;
  name: string;
}

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  status: string;
  method: string;
  date: string;
  checked_at: string | null;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  present: { label: '출석', bg: 'bg-green-100', text: 'text-green-700', icon: Check },
  late: { label: '지각', bg: 'bg-orange-100', text: 'text-orange-700', icon: Clock },
  absent: { label: '결석', bg: 'bg-red-100', text: 'text-red-700', icon: X },
  early_leave: { label: '조퇴', bg: 'bg-purple-100', text: 'text-purple-700', icon: EarlyLeave },
};

const methodLabel: Record<string, string> = {
  qr: 'QR',
  pin: 'PIN',
  manual: '수동',
  kiosk: 'NFC',
};

export default function Attendance() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    api.get('/classrooms').then(r => setClassrooms(r.data));
    api.get('/students').then(r => setAllStudents(r.data));
  }, []);

  const loadRecords = () => {
    const params: any = { start_date: date, end_date: date };
    if (selectedClassroom) params.classroom_id = selectedClassroom;
    api.get('/attendance/history', { params }).then(r => setRecords(r.data));
  };

  useEffect(() => {
    loadRecords();
  }, [date, selectedClassroom]);

  // 현재 반에 속한 학생 목록 (반 선택 안 했으면 전체)
  const students: Student[] = selectedClassroom
    ? (classrooms.find(c => c.id === selectedClassroom)?.students || []).map(sc => sc.student)
    : allStudents;

  // 학생별 출석 상태 매핑
  const statusByStudent = new Map<number, AttendanceRecord>();
  records.forEach(r => statusByStudent.set(r.student_id, r));

  // 출결 상태 설정 (수동)
  const setStatus = async (studentId: number, status: string) => {
    try {
      await api.post('/attendance/manual-set', {
        student_id: studentId,
        date,
        status,
        classroom_id: selectedClassroom || null,
      });
      loadRecords();
    } catch (err: any) {
      alert(err.response?.data?.detail || '처리 실패');
    }
  };

  const removeStatus = async (recordId: number) => {
    try {
      await api.delete(`/attendance/${recordId}`);
      loadRecords();
    } catch (err: any) {
      alert(err.response?.data?.detail || '삭제 실패');
    }
  };

  // 요약 통계
  const summary = {
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    early_leave: records.filter(r => r.status === 'early_leave').length,
  };
  const totalStudents = students.length;
  const uncheckedCount = totalStudents - records.filter(r =>
    students.some(s => s.id === r.student_id)
  ).length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">출결 관리</h2>

      {/* 필터 */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setDate(today)}
            className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm font-medium text-gray-700">반</label>
          <select
            value={selectedClassroom || ''}
            onChange={(e) => setSelectedClassroom(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">전체 학생</p>
          <p className="text-2xl font-bold">{totalStudents}명</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-700">출석</p>
          <p className="text-2xl font-bold text-green-700">{summary.present}</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
          <p className="text-xs text-orange-700">지각</p>
          <p className="text-2xl font-bold text-orange-700">{summary.late}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs text-red-700">결석</p>
          <p className="text-2xl font-bold text-red-700">{summary.absent}</p>
        </div>
        <div className="bg-gray-50 rounded-xl border p-4">
          <p className="text-xs text-gray-500">미체크</p>
          <p className="text-2xl font-bold text-gray-700">{uncheckedCount}</p>
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">방식</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">시간</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">수동 처리</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => {
              const record = statusByStudent.get(student.id);
              const config = record ? statusConfig[record.status] : null;
              const Icon = config?.icon;
              return (
                <tr key={student.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{student.name}</td>
                  <td className="px-4 py-3">
                    {config ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                        {Icon && <Icon size={12} />} {config.label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">미체크</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {record ? methodLabel[record.method] || record.method : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {record?.checked_at ? new Date(record.checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {['present', 'late', 'absent', 'early_leave'].map(st => {
                        const cfg = statusConfig[st];
                        const isActive = record?.status === st;
                        return (
                          <button
                            key={st}
                            onClick={() => setStatus(student.id, st)}
                            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                              isActive
                                ? `${cfg.bg} ${cfg.text} border-current`
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                      {record && (
                        <button
                          onClick={() => removeStatus(record.id)}
                          className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50"
                          title="기록 삭제"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {students.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            {selectedClassroom ? '이 반에 배정된 학생이 없습니다' : '등록된 원생이 없습니다'}
          </p>
        )}
      </div>
    </div>
  );
}
