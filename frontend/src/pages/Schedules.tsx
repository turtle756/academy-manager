import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';

interface Schedule { id: number; classroom_id: number; classroom_name: string; teacher_id: number; teacher_name: string; day_of_week: string; start_time: string; end_time: string; room: string }
interface Classroom { id: number; name: string }

const days = [
  { key: 'mon', label: '월' }, { key: 'tue', label: '화' }, { key: 'wed', label: '수' },
  { key: 'thu', label: '목' }, { key: 'fri', label: '금' }, { key: 'sat', label: '토' }, { key: 'sun', label: '일' },
];

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ classroom_id: '', day_of_week: 'mon', start_time: '14:00', end_time: '16:00', room: '' });

  const load = () => api.get('/schedules').then(r => setSchedules(r.data));
  useEffect(() => { load(); api.get('/classrooms').then(r => setClassrooms(r.data)); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/schedules', { ...form, classroom_id: Number(form.classroom_id) });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/schedules/${id}`);
    load();
  };

  const grouped = days.map(d => ({
    ...d,
    items: schedules.filter(s => s.day_of_week === d.key).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">시간표</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 수업 추가
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <select required value={form.classroom_id} onChange={e => setForm({...form, classroom_id: e.target.value})} className="px-3 py-2 border rounded-lg outline-none">
            <option value="">반 선택</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.day_of_week} onChange={e => setForm({...form, day_of_week: e.target.value})} className="px-3 py-2 border rounded-lg outline-none">
            {days.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="px-3 py-2 border rounded-lg outline-none" />
          <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="px-3 py-2 border rounded-lg outline-none" />
          <div className="flex gap-2">
            <input value={form.room} onChange={e => setForm({...form, room: e.target.value})} placeholder="교실" className="flex-1 px-3 py-2 border rounded-lg outline-none" />
            <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg">추가</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {grouped.map(d => (
          <div key={d.key} className="bg-white rounded-xl border border-gray-200 p-3">
            <h3 className="text-center font-semibold text-gray-700 mb-3 pb-2 border-b">{d.label}</h3>
            <div className="space-y-2">
              {d.items.map(s => (
                <div key={s.id} className="p-2 bg-blue-50 rounded-lg text-xs group relative">
                  <p className="font-medium text-gray-900">{s.classroom_name}</p>
                  <p className="text-gray-500">{s.start_time}~{s.end_time}</p>
                  {s.room && <p className="text-gray-400">{s.room}</p>}
                  <button onClick={() => handleDelete(s.id)} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded">
                    <Trash2 size={12} className="text-red-500" />
                  </button>
                </div>
              ))}
              {d.items.length === 0 && <p className="text-xs text-gray-300 text-center">-</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
