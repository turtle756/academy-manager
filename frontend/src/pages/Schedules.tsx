import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';

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

const days = [
  { key: 'mon', label: '월' }, { key: 'tue', label: '화' }, { key: 'wed', label: '수' },
  { key: 'thu', label: '목' }, { key: 'fri', label: '금' }, { key: 'sat', label: '토' }, { key: 'sun', label: '일' },
];

// 시간대: 8시 ~ 23시
const START_HOUR = 8;
const END_HOUR = 23;
const HOUR_HEIGHT = 60; // px per hour

// 수업마다 일관된 색상
const COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-900' },
  { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-900' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-900' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-900' },
  { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-900' },
  { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-900' },
  { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-900' },
];

function getColor(classroomId: number) {
  return COLORS[classroomId % COLORS.length];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToY(minutes: number): number {
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    classroom_id: '', day_of_week: 'mon', start_time: '14:00', end_time: '16:00', room: ''
  });

  const load = () => api.get('/schedules').then(r => setSchedules(r.data));
  useEffect(() => {
    load();
    api.get('/classrooms').then(r => setClassrooms(r.data));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/schedules', { ...form, classroom_id: Number(form.classroom_id) });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.delete(`/schedules/${id}`);
    load();
  };

  // 요일별 수업 그룹핑
  const schedulesByDay: Record<string, Schedule[]> = {};
  days.forEach(d => { schedulesByDay[d.key] = []; });
  schedules.forEach(s => { schedulesByDay[s.day_of_week]?.push(s); });

  // 시간 레이블 (8시 ~ 23시)
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">시간표</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus size={16} /> 수업 추가
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">수업 추가</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <select required value={form.classroom_id} onChange={e => setForm({...form, classroom_id: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">반 선택</option>
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-3">
                <select value={form.day_of_week} onChange={e => setForm({...form, day_of_week: e.target.value})}
                  className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  {days.map(d => <option key={d.key} value={d.key}>{d.label}요일</option>)}
                </select>
                <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})}
                  className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})}
                  className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <input value={form.room} onChange={e => setForm({...form, room: e.target.value})} placeholder="교실 (선택)"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">추가</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 에브리타임 스타일 시간표 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex">
          {/* 시간 레이블 */}
          <div className="w-14 border-r flex-shrink-0">
            <div className="h-10 border-b bg-gray-50" />
            <div className="relative" style={{ height: totalHeight }}>
              {hours.slice(0, -1).map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 text-xs text-gray-400 font-mono pr-2 text-right"
                  style={{ top: i * HOUR_HEIGHT + 4 }}
                >
                  {h}:00
                </div>
              ))}
            </div>
          </div>

          {/* 요일 컬럼 */}
          {days.map(day => (
            <div key={day.key} className="flex-1 border-r last:border-r-0 min-w-0">
              {/* 요일 헤더 */}
              <div className="h-10 border-b bg-gray-50 flex items-center justify-center font-medium text-sm text-gray-700">
                {day.label}
              </div>

              {/* 수업 배치 영역 */}
              <div className="relative" style={{ height: totalHeight }}>
                {/* 시간 그리드 라인 */}
                {hours.slice(0, -1).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: (i + 1) * HOUR_HEIGHT }}
                  />
                ))}

                {/* 수업 블록 */}
                {schedulesByDay[day.key].map(s => {
                  const startMin = timeToMinutes(s.start_time);
                  const endMin = timeToMinutes(s.end_time);
                  const top = minutesToY(startMin);
                  const height = minutesToY(endMin) - top;
                  const color = getColor(s.classroom_id);
                  return (
                    <div
                      key={s.id}
                      className={`absolute left-1 right-1 rounded-lg border-l-4 ${color.bg} ${color.border} ${color.text} p-1.5 group cursor-pointer overflow-hidden hover:shadow-md transition-shadow`}
                      style={{ top, height: Math.max(height, 24) }}
                    >
                      <div className="text-xs font-bold truncate">{s.classroom_name}</div>
                      <div className="text-[10px] opacity-80 truncate">{s.start_time}~{s.end_time}</div>
                      {s.room && <div className="text-[10px] opacity-70 truncate">{s.room}</div>}
                      {s.teacher_name && <div className="text-[10px] opacity-70 truncate">{s.teacher_name}</div>}
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/50 rounded"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
