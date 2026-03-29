import { useEffect, useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import api from '../lib/api';

interface Student { id: number; name: string }
interface Classroom { id: number; name: string; students: { student: Student }[] }

export default function Classrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  const load = () => {
    api.get('/classrooms').then(r => setClassrooms(r.data));
    api.get('/students').then(r => setAllStudents(r.data));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/classrooms', { name });
    setName('');
    setShowForm(false);
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
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 반 추가
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-4 mb-4 flex gap-3">
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="반 이름 (예: 중등수학A)" className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">추가</button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">취소</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classrooms.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{c.name}</h3>
              <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">{c.students?.length || 0}명</p>
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
