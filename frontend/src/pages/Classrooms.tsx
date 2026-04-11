import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Edit2 } from 'lucide-react';
import api from '../lib/api';

interface Student { id: number; name: string }
interface Classroom { id: number; name: string; monthly_fee: number; students: { student: Student }[] }

export default function Classrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState({ name: '', monthly_fee: '' });
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  const load = () => {
    api.get('/classrooms').then(r => setClassrooms(r.data));
    api.get('/students').then(r => setAllStudents(r.data));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', monthly_fee: '' });
    setShowForm(true);
  };

  const openEdit = (c: Classroom) => {
    setEditing(c);
    setForm({ name: c.name, monthly_fee: String(c.monthly_fee || '') });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name, monthly_fee: Number(form.monthly_fee) || 0 };
    if (editing) {
      await api.patch(`/classrooms/${editing.id}`, payload);
    } else {
      await api.post('/classrooms', payload);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await api.delete(`/classrooms/${id}`);
    load();
  };

  const openAssign = (classroomId: number) => {
    const cr = classrooms.find(c => c.id === classroomId);
    setSelectedStudents(cr?.students.map(s => s.student.id) || []);
    setAssignModal(classroomId);
  };

  const handleAssign = async () => {
    if (assignModal === null) return;
    await api.post(`/classrooms/${assignModal}/students`, { student_ids: selectedStudents });
    setAssignModal(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">반 관리</h2>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 반 추가
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">{editing ? '반 수정' : '반 추가'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">반 이름 *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="예: 중등수학A" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">월 수강료 (원)</label>
                <input type="number" value={form.monthly_fee} onChange={e => setForm({...form, monthly_fee: e.target.value})} placeholder="예: 300000" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">월 청구서 일괄 생성 시 이 금액이 자동 청구됩니다</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? '수정' : '추가'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classrooms.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{c.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 size={14} className="text-gray-400" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3 text-sm">
              <span className="text-gray-500">{c.students?.length || 0}명</span>
              {c.monthly_fee > 0 && (
                <span className="text-blue-600 font-medium">월 {c.monthly_fee.toLocaleString()}원</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {c.students?.slice(0, 5).map(sc => (
                <span key={sc.student.id} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{sc.student.name}</span>
              ))}
              {(c.students?.length || 0) > 5 && <span className="px-2 py-0.5 text-xs text-gray-400">+{c.students.length - 5}명</span>}
            </div>
            <button onClick={() => openAssign(c.id)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
              <Users size={14} /> 학생 배정
            </button>
          </div>
        ))}
      </div>

      {assignModal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">학생 배정</h3>
            <div className="space-y-2 mb-4">
              {allStudents.map(s => (
                <label key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(s.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedStudents([...selectedStudents, s.id]);
                      else setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleAssign} className="flex-1 py-2 bg-blue-600 text-white rounded-lg">저장</button>
              <button onClick={() => setAssignModal(null)} className="px-4 py-2 border rounded-lg">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
