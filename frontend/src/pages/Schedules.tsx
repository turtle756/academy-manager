import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

interface Schedule {
  id: number;
  classroom_id: number;
  classroom_name: string;
  teacher_id: number | null;
  teacher_name: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
}
interface Classroom { id: number; name: string }
interface Teacher { user_id: number; name: string; email: string; role: string }

type ViewMode = 'room' | 'teacher';

const days = [
  { key: 'mon', label: '월' }, { key: 'tue', label: '화' }, { key: 'wed', label: '수' },
  { key: 'thu', label: '목' }, { key: 'fri', label: '금' }, { key: 'sat', label: '토' }, { key: 'sun', label: '일' },
];

const START_HOUR = 8;
const END_HOUR = 23;
const HOUR_HEIGHT = 60;

const COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-900' },
  { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-900' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-900' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-900' },
  { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-900' },
  { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-900' },
  { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-900' },
];

function getColorByIndex(idx: number) { return COLORS[idx % COLORS.length]; }

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function minutesToY(minutes: number): number {
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

export default function Schedules() {
  const { academyRole } = useAuth();
  const isTeacher = academyRole === 'teacher';

  // 원장/부원장은 강의실 기본, 강사는 강사별 기본
  const [viewMode, setViewMode] = useState<ViewMode>(isTeacher ? 'teacher' : 'room');
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | 'all'>('all');

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    classroom_id: '', teacher_id: '', day_of_week: 'mon', start_time: '14:00', end_time: '16:00', room: ''
  });

  const load = () => api.get('/schedules').then(r => setSchedules(r.data));
  useEffect(() => {
    load();
    api.get('/classrooms').then(r => setClassrooms(r.data));
    api.get('/academies/members').then(r => setTeachers(r.data)).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/schedules', {
      ...form,
      classroom_id: Number(form.classroom_id),
      teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
    });
    setShowForm(false);
    setForm({ classroom_id: '', teacher_id: '', day_of_week: 'mon', start_time: '14:00', end_time: '16:00', room: '' });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.delete(`/schedules/${id}`);
    load();
  };

  // 뷰 모드에 따른 필터
  const filteredSchedules = viewMode === 'teacher' && selectedTeacherId !== 'all'
    ? schedules.filter(s => s.teacher_id === selectedTeacherId)
    : schedules;

  // 강의실별 색상 인덱스
  const classroomColorMap: Record<number, number> = {};
  classrooms.forEach((c, i) => { classroomColorMap[c.id] = i; });

  // 강사별 색상 인덱스
  const teacherIds = [...new Set(schedules.map(s => s.teacher_id).filter(Boolean))] as number[];
  const teacherColorMap: Record<number, number> = {};
  teacherIds.forEach((id, i) => { teacherColorMap[id] = i; });

  const schedulesByDay: Record<string, Schedule[]> = {};
  days.forEach(d => { schedulesByDay[d.key] = []; });
  filteredSchedules.forEach(s => { schedulesByDay[s.day_of_week]?.push(s); });

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">시간표</h2>
        {!isTeacher && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <Plus size={16} /> 수업 추가
          </button>
        )}
      </div>

      {/* 뷰 전환 탭 + 강사 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setViewMode('room')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'room' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            강의실별
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'teacher' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            강사별
          </button>
        </div>

        {viewMode === 'teacher' && !isTeacher && (
          <select
            value={selectedTeacherId}
            onChange={e => setSelectedTeacherId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-1.5 border rounded-lg text-sm outline-none"
          >
            <option value="all">전체 강사</option>
            {teachers.map(t => (
              <option key={t.user_id} value={t.user_id}>{t.name}</option>
            ))}
            <option value={-1}>미배정</option>
          </select>
        )}

        {/* 범례 */}
        <div className="ml-auto flex flex-wrap gap-2">
          {viewMode === 'room'
            ? classrooms.map((c, i) => {
                const col = getColorByIndex(i);
                return <span key={c.id} className={`px-2 py-0.5 rounded text-xs font-medium ${col.bg} ${col.text}`}>{c.name}</span>;
              })
            : teacherIds.map((id, i) => {
                const t = teachers.find(t => t.user_id === id);
                const col = getColorByIndex(i);
                return <span key={id} className={`px-2 py-0.5 rounded text-xs font-medium ${col.bg} ${col.text}`}>{t?.name || '미배정'}</span>;
              })
          }
        </div>
      </div>

      {/* 수업 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">수업 추가</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">반 *</label>
                  <select required value={form.classroom_id} onChange={e => setForm({...form, classroom_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                    <option value="">선택</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당 강사</label>
                  <select value={form.teacher_id} onChange={e => setForm({...form, teacher_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                    <option value="">미배정</option>
                    {teachers.map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">요일</label>
                  <select value={form.day_of_week} onChange={e => setForm({...form, day_of_week: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                    {days.map(d => <option key={d.key} value={d.key}>{d.label}요일</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">시작</label>
                  <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">종료</label>
                  <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">강의실 (선택)</label>
                <input value={form.room} onChange={e => setForm({...form, room: e.target.value})} placeholder="예: A실, 201호"
                  className="w-full px-3 py-2 border rounded-lg outline-none text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">추가</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 시간표 그리드 */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <div className="flex min-w-[600px]">
          {/* 시간 레이블 */}
          <div className="w-14 border-r flex-shrink-0">
            <div className="h-10 border-b bg-gray-50" />
            <div className="relative" style={{ height: totalHeight }}>
              {hours.slice(0, -1).map((h, i) => (
                <div key={h} className="absolute left-0 right-0 text-xs text-gray-400 font-mono pr-2 text-right" style={{ top: i * HOUR_HEIGHT + 4 }}>
                  {h}:00
                </div>
              ))}
            </div>
          </div>

          {days.map(day => (
            <div key={day.key} className="flex-1 border-r last:border-r-0 min-w-0">
              <div className="h-10 border-b bg-gray-50 flex items-center justify-center font-medium text-sm text-gray-700">
                {day.label}
              </div>
              <div className="relative" style={{ height: totalHeight }}>
                {hours.slice(0, -1).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (i + 1) * HOUR_HEIGHT }} />
                ))}
                {schedulesByDay[day.key].map(s => {
                  const startMin = timeToMinutes(s.start_time);
                  const endMin = timeToMinutes(s.end_time);
                  const top = minutesToY(startMin);
                  const height = minutesToY(endMin) - top;
                  // 강의실별: classroom 색상 / 강사별: teacher 색상
                  const colorIdx = viewMode === 'room'
                    ? (classroomColorMap[s.classroom_id] ?? 0)
                    : (s.teacher_id ? (teacherColorMap[s.teacher_id] ?? 0) : 6);
                  const color = getColorByIndex(colorIdx);
                  return (
                    <div
                      key={s.id}
                      className={`absolute left-1 right-1 rounded-lg border-l-4 ${color.bg} ${color.border} ${color.text} p-1.5 group cursor-pointer overflow-hidden hover:shadow-md transition-shadow`}
                      style={{ top, height: Math.max(height, 24) }}
                    >
                      <div className="text-xs font-bold truncate">{s.classroom_name}</div>
                      <div className="text-[10px] opacity-80 truncate">{s.start_time}~{s.end_time}</div>
                      {viewMode === 'room' && s.teacher_name && <div className="text-[10px] opacity-70 truncate">{s.teacher_name}</div>}
                      {viewMode === 'teacher' && s.room && <div className="text-[10px] opacity-70 truncate">{s.room}</div>}
                      {!isTeacher && (
                        <button onClick={() => handleDelete(s.id)} className="absolute top-0.5 right-0.5 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/50 rounded">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {schedules.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">등록된 수업이 없습니다.</p>
      )}
    </div>
  );
}
