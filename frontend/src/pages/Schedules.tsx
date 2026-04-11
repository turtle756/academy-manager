import { useEffect, useState } from 'react';
import { Plus, Trash2, Settings2, X } from 'lucide-react';
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
  room_id: number | null;
  room_name: string | null;
}
interface Classroom { id: number; name: string }
interface Teacher { user_id: number; name: string }
interface Room { id: number; name: string }

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
function getColor(idx: number) { return COLORS[idx % COLORS.length]; }
function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minToY(min: number) { return ((min - START_HOUR * 60) / 60) * HOUR_HEIGHT; }

export default function Schedules() {
  const { academyRole } = useAuth();
  const isTeacher = academyRole === 'teacher';

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // 탭: room_id | 'all' | 'mine'(강사전용)
  const [activeTab, setActiveTab] = useState<number | 'all' | 'mine'>('all');

  // 수업 추가 모달
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    classroom_id: '', teacher_id: '', day_of_week: 'mon',
    start_time: '14:00', end_time: '16:00', room_id: '',
  });

  // 강의실 관리 모달
  const [showRoomMgr, setShowRoomMgr] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const load = () => {
    api.get('/schedules').then(r => setSchedules(r.data));
    api.get('/rooms').then(r => setRooms(r.data));
  };

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
      room_id: form.room_id ? Number(form.room_id) : null,
    });
    setShowForm(false);
    setForm({ classroom_id: '', teacher_id: '', day_of_week: 'mon', start_time: '14:00', end_time: '16:00', room_id: '' });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.delete(`/schedules/${id}`);
    load();
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    await api.post('/rooms', { name: newRoomName.trim() });
    setNewRoomName('');
    load();
  };

  const handleDeleteRoom = async (id: number) => {
    if (!confirm('강의실을 삭제하면 해당 강의실의 수업 배정이 해제됩니다. 삭제할까요?')) return;
    await api.delete(`/rooms/${id}`);
    load();
  };

  // 탭에 따른 수업 필터
  const filtered = schedules.filter(s => {
    if (activeTab === 'mine') return true; // teacher view: 전체 (서버에서 이미 필터됨)
    if (activeTab === 'all') return true;
    return s.room_id === activeTab;
  });

  // 반별 색상
  const classroomColorMap: Record<number, number> = {};
  classrooms.forEach((c, i) => { classroomColorMap[c.id] = i; });

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  // 강의실 없는 수업 (room_id=null)은 별도 처리
  const unassignedRoomSchedules = filtered.filter(s => !s.room_id);
  const assignedRoomIds = [...new Set(filtered.filter(s => s.room_id).map(s => s.room_id as number))];

  // 현재 탭에서 표시할 강의실 목록
  const displayRooms = activeTab === 'all'
    ? rooms
    : activeTab === 'mine'
    ? []
    : rooms.filter(r => r.id === activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">시간표</h2>
        <div className="flex gap-2">
          {!isTeacher && (
            <>
              <button onClick={() => setShowRoomMgr(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">
                <Settings2 size={15} /> 강의실 관리
              </button>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus size={16} /> 수업 추가
              </button>
            </>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        <button onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          전체
        </button>
        {rooms.map(r => (
          <button key={r.id} onClick={() => setActiveTab(r.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === r.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {r.name}
          </button>
        ))}
        {isTeacher && (
          <button onClick={() => setActiveTab('mine')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            내 수업
          </button>
        )}
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">강의실</label>
                  <select value={form.room_id} onChange={e => setForm({...form, room_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                    <option value="">미배정</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">담당 강사</label>
                <select value={form.teacher_id} onChange={e => setForm({...form, teacher_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                  <option value="">미배정</option>
                  {teachers.map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                </select>
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
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">추가</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 강의실 관리 모달 */}
      {showRoomMgr && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">강의실 관리</h3>
              <button onClick={() => setShowRoomMgr(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddRoom} className="flex gap-2 mb-4">
              <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                placeholder="강의실 이름 (예: A실, 201호)"
                className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">추가</button>
            </form>
            <div className="space-y-2">
              {rooms.length === 0 && <p className="text-sm text-gray-400 text-center py-2">등록된 강의실이 없습니다</p>}
              {rooms.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{r.name}</span>
                  <button onClick={() => handleDeleteRoom(r.id)} className="p-1 hover:bg-red-50 rounded text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 시간표 그리드 — 강의실별 */}
      {activeTab === 'all' && rooms.length > 0 ? (
        // 전체 탭: 강의실별로 나눠서 표시
        <div className="space-y-6">
          {rooms.map(room => {
            const roomSchedules = filtered.filter(s => s.room_id === room.id);
            return (
              <div key={room.id} className="bg-white rounded-xl border overflow-x-auto">
                <div className="px-4 py-2.5 bg-gray-50 border-b font-semibold text-sm text-gray-700">
                  {room.name}
                </div>
                <TimetableGrid
                  schedules={roomSchedules}
                  classroomColorMap={classroomColorMap}
                  isTeacher={isTeacher}
                  onDelete={handleDelete}
                  hours={hours}
                  totalHeight={totalHeight}
                />
              </div>
            );
          })}
          {unassignedRoomSchedules.length > 0 && (
            <div className="bg-white rounded-xl border overflow-x-auto">
              <div className="px-4 py-2.5 bg-gray-50 border-b font-semibold text-sm text-gray-500">강의실 미배정</div>
              <TimetableGrid
                schedules={unassignedRoomSchedules}
                classroomColorMap={classroomColorMap}
                isTeacher={isTeacher}
                onDelete={handleDelete}
                hours={hours}
                totalHeight={totalHeight}
              />
            </div>
          )}
        </div>
      ) : (
        // 특정 강의실 탭 or 강의실 없을 때
        <div className="bg-white rounded-xl border overflow-x-auto">
          <TimetableGrid
            schedules={filtered}
            classroomColorMap={classroomColorMap}
            isTeacher={isTeacher}
            onDelete={handleDelete}
            hours={hours}
            totalHeight={totalHeight}
          />
        </div>
      )}

      {rooms.length === 0 && !isTeacher && (
        <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-blue-700 text-center">
          강의실을 먼저 추가하면 강의실별로 시간표를 구분해 볼 수 있습니다.
          <button onClick={() => setShowRoomMgr(true)} className="ml-2 underline font-medium">강의실 추가 →</button>
        </div>
      )}
    </div>
  );
}

// ── 시간표 그리드 컴포넌트 ─────────────────────────────────
function TimetableGrid({ schedules, classroomColorMap, isTeacher, onDelete, hours, totalHeight }: {
  schedules: Schedule[];
  classroomColorMap: Record<number, number>;
  isTeacher: boolean;
  onDelete: (id: number) => void;
  hours: number[];
  totalHeight: number;
}) {
  const byDay: Record<string, Schedule[]> = {};
  ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => { byDay[d] = []; });
  schedules.forEach(s => { byDay[s.day_of_week]?.push(s); });

  const days = [
    { key: 'mon', label: '월' }, { key: 'tue', label: '화' }, { key: 'wed', label: '수' },
    { key: 'thu', label: '목' }, { key: 'fri', label: '금' }, { key: 'sat', label: '토' }, { key: 'sun', label: '일' },
  ];

  function getColor(idx: number) { return COLORS[idx % COLORS.length]; }

  return (
    <div className="flex min-w-[600px]">
      {/* 시간 레이블 */}
      <div className="w-14 border-r flex-shrink-0">
        <div className="h-10 border-b bg-gray-50" />
        <div className="relative" style={{ height: totalHeight }}>
          {hours.slice(0, -1).map((h, i) => (
            <div key={h} className="absolute left-0 right-0 text-xs text-gray-400 font-mono pr-2 text-right"
              style={{ top: i * HOUR_HEIGHT + 4 }}>{h}:00</div>
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
            {byDay[day.key].map(s => {
              const top = minToY(timeToMin(s.start_time));
              const height = minToY(timeToMin(s.end_time)) - top;
              const color = getColor(classroomColorMap[s.classroom_id] ?? 0);
              return (
                <div key={s.id}
                  className={`absolute left-1 right-1 rounded-lg border-l-4 ${color.bg} ${color.border} ${color.text} p-1.5 group cursor-pointer overflow-hidden hover:shadow-md transition-shadow`}
                  style={{ top, height: Math.max(height, 24) }}>
                  <div className="text-xs font-bold truncate">{s.classroom_name}</div>
                  <div className="text-[10px] opacity-80 truncate">{s.start_time}~{s.end_time}</div>
                  {s.teacher_name && <div className="text-[10px] opacity-70 truncate">{s.teacher_name}</div>}
                  {!isTeacher && (
                    <button onClick={() => onDelete(s.id)}
                      className="absolute top-0.5 right-0.5 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/50 rounded">
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
  );
}
