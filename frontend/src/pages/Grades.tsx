import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../lib/api';

interface Grade { id: number; student_id: number; student_name: string; classroom_id: number; exam_name: string; score: number; total_score: number; date: string; note: string }
interface Classroom { id: number; name: string }

export default function Grades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_id: '', classroom_id: '', exam_name: '', score: '', total_score: '100', date: '', note: '' });
  const [students, setStudents] = useState<{ id: number; name: string }[]>([]);

  const load = () => api.get('/grades').then(r => setGrades(r.data));
  useEffect(() => {
    load();
    api.get('/classrooms').then(r => setClassrooms(r.data));
    api.get('/students').then(r => setStudents(r.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/grades', { ...form, student_id: Number(form.student_id), classroom_id: Number(form.classroom_id), score: Number(form.score), total_score: Number(form.total_score) });
    setShowForm(false);
    load();
  };

  const filtered = filter ? grades.filter(g => g.classroom_id === Number(filter)) : grades;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">성적 관리</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 성적 입력
        </button>
      </div>

      <select value={filter} onChange={e => setFilter(e.target.value)} className="mb-4 px-3 py-2 border rounded-lg outline-none">
        <option value="">전체 반</option>
        {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">성적 입력</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <select required value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none">
                <option value="">학생 선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select required value={form.classroom_id} onChange={e => setForm({...form, classroom_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none">
                <option value="">반 선택</option>
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input required value={form.exam_name} onChange={e => setForm({...form, exam_name: e.target.value})} placeholder="시험 이름 (예: 3월 모의고사)" className="w-full px-3 py-2 border rounded-lg outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" value={form.score} onChange={e => setForm({...form, score: e.target.value})} placeholder="점수" className="px-3 py-2 border rounded-lg outline-none" />
                <input required type="number" value={form.total_score} onChange={e => setForm({...form, total_score: e.target.value})} placeholder="만점" className="px-3 py-2 border rounded-lg outline-none" />
              </div>
              <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none" />
              <textarea value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="메모" className="w-full px-3 py-2 border rounded-lg outline-none" rows={2} />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg">저장</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">학생</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">시험</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">점수</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">날짜</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{g.student_name}</td>
                <td className="px-4 py-3">{g.exam_name}</td>
                <td className="px-4 py-3 font-mono">{g.score}/{g.total_score}</td>
                <td className="px-4 py-3 text-gray-500">{g.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
