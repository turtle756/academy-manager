import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';

interface CounselingRecord { id: number; student_id: number; student_name: string; teacher_name: string; date: string; title: string; content: string }

const today = () => new Date().toISOString().slice(0, 10);

export default function Counseling() {
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [students, setStudents] = useState<{ id: number; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_id: '', date: today(), title: '', content: '' });

  const load = () => api.get('/counseling').then(r => setRecords(r.data));
  useEffect(() => { load(); api.get('/students').then(r => setStudents(r.data)); }, []);

  const openForm = () => {
    setForm({ student_id: '', date: today(), title: '', content: '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/counseling', { ...form, student_id: Number(form.student_id) });
    setShowForm(false);
    setForm({ student_id: '', date: today(), title: '', content: '' });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.delete(`/counseling/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">상담일지</h2>
        <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 상담 기록
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">상담 기록 작성</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <select required value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none">
                <option value="">학생 선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none" />
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="제목 (예: 집중력 저하 상담)" className="w-full px-3 py-2 border rounded-lg outline-none" />
              <textarea required value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="상담 내용" className="w-full px-3 py-2 border rounded-lg outline-none" rows={5} />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg">저장</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {records.map(r => (
          <div key={r.id} className="bg-white rounded-xl border p-5 group">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{r.student_name}</span>
                  <span className="text-sm text-gray-400">{r.date}</span>
                  <span className="text-sm text-gray-400">by {r.teacher_name}</span>
                </div>
                <h4 className="font-medium text-gray-800 mb-1">{r.title}</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.content}</p>
              </div>
              <button onClick={() => handleDelete(r.id)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded">
                <Trash2 size={14} className="text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {records.length === 0 && <p className="text-center text-gray-500 py-8">상담 기록이 없습니다.</p>}
      </div>
    </div>
  );
}
