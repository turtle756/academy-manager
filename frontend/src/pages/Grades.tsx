import { useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import api from '../lib/api';

interface Grade {
  id: number;
  student_id: number;
  student_name: string;
  classroom_id: number;
  exam_name: string;
  score: number;
  total_score: number;
  date: string;
}

interface Classroom {
  id: number;
  name: string;
  students?: { student: { id: number; name: string } }[];
}

export default function Grades() {
  const today = new Date().toISOString().slice(0, 10);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [filterClassroom, setFilterClassroom] = useState<number | null>(null);

  const [showInput, setShowInput] = useState(false);
  const [inputForm, setInputForm] = useState({
    classroom_id: 0,
    exam_name: '',
    total_score: 100,
    date: today,
  });
  const [scores, setScores] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get('/classrooms').then(r => setClassrooms(r.data));
    loadGrades();
  }, []);

  const loadGrades = () => {
    const params = filterClassroom ? { classroom_id: filterClassroom } : {};
    api.get('/grades', { params }).then(r => setGrades(r.data));
  };

  useEffect(() => { loadGrades(); }, [filterClassroom]);

  const openInputMode = () => {
    setInputForm({ classroom_id: 0, exam_name: '', total_score: 100, date: today });
    setScores({});
    setShowInput(true);
  };

  const currentClassroom = classrooms.find(c => c.id === inputForm.classroom_id);
  const studentsInClass = currentClassroom?.students?.map(sc => sc.student) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputForm.classroom_id || !inputForm.exam_name.trim()) {
      alert('반과 시험 이름을 입력해주세요');
      return;
    }
    const scoreEntries = Object.entries(scores).filter(([_, v]) => v !== '' && v !== undefined);
    if (scoreEntries.length === 0) {
      alert('하나 이상의 점수를 입력해주세요');
      return;
    }

    try {
      for (const [studentId, scoreStr] of scoreEntries) {
        await api.post('/grades', {
          student_id: Number(studentId),
          classroom_id: inputForm.classroom_id,
          exam_name: inputForm.exam_name,
          score: Number(scoreStr),
          total_score: inputForm.total_score,
          date: inputForm.date,
        });
      }
      setShowInput(false);
      loadGrades();
    } catch (err: any) {
      alert(err.response?.data?.detail || '저장 실패');
    }
  };

  // 성적 그룹핑: 반 + 시험 이름 + 날짜별
  const groupedGrades = grades.reduce<Record<string, Grade[]>>((acc, g) => {
    const key = `${g.classroom_id}__${g.exam_name}__${g.date}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groupedGrades).sort((a, b) => {
    const aDate = a[1][0]?.date || '';
    const bDate = b[1][0]?.date || '';
    return bDate.localeCompare(aDate);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">성적 관리</h2>
        <button
          onClick={openInputMode}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus size={16} /> 성적 입력
        </button>
      </div>

      <div className="mb-4">
        <select
          value={filterClassroom || ''}
          onChange={e => setFilterClassroom(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 반</option>
          {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* 성적 입력 모달 */}
      {showInput && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold">성적 입력</h3>
              <button onClick={() => setShowInput(false)} className="p-1.5 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4 border-b">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">반 *</label>
                    <select
                      required
                      value={inputForm.classroom_id || ''}
                      onChange={e => { setInputForm({...inputForm, classroom_id: Number(e.target.value)}); setScores({}); }}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">선택</option>
                      {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">시험 날짜 *</label>
                    <input
                      required
                      type="date"
                      value={inputForm.date}
                      onChange={e => setInputForm({...inputForm, date: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">시험 이름 *</label>
                    <input
                      required
                      value={inputForm.exam_name}
                      onChange={e => setInputForm({...inputForm, exam_name: e.target.value})}
                      placeholder="예: 3월 모의고사"
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">만점</label>
                    <input
                      type="number"
                      value={inputForm.total_score}
                      onChange={e => setInputForm({...inputForm, total_score: Number(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  학생별 점수 입력
                  {studentsInClass.length > 0 && <span className="ml-2 text-gray-400">({studentsInClass.length}명)</span>}
                </h4>
                {!inputForm.classroom_id ? (
                  <p className="text-sm text-gray-400 text-center py-8">먼저 반을 선택하세요</p>
                ) : studentsInClass.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">이 반에 배정된 학생이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {studentsInClass.map(s => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm font-medium text-gray-900">{s.name}</span>
                        <input
                          type="number"
                          value={scores[s.id] || ''}
                          onChange={e => setScores({...scores, [s.id]: e.target.value})}
                          placeholder="점수"
                          className="w-28 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right font-mono"
                        />
                        <span className="text-sm text-gray-400 w-10">/{inputForm.total_score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="p-4 border-t flex gap-2">
              <button
                type="button"
                onClick={() => setShowInput(false)}
                className="flex-1 py-2.5 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Save size={16} /> 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 성적 목록 (그룹별) */}
      <div className="space-y-4">
        {sortedGroups.map(([key, items]) => {
          const first = items[0];
          const classroom = classrooms.find(c => c.id === first.classroom_id);
          return (
            <div key={key} className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b flex items-center gap-3">
                <span className="font-semibold text-gray-900">{first.exam_name}</span>
                <span className="text-sm text-gray-500">{classroom?.name || '-'}</span>
                <span className="text-xs text-gray-400 ml-auto">{first.date}</span>
              </div>
              <div className="divide-y">
                {items.sort((a, b) => b.score - a.score).map(g => (
                  <div key={g.id} className="px-5 py-2.5 flex items-center">
                    <span className="flex-1 text-sm text-gray-900">{g.student_name}</span>
                    <span className="font-mono text-gray-700">{g.score}<span className="text-gray-400 text-sm">/{g.total_score}</span></span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {sortedGroups.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">성적 기록이 없습니다</div>
        )}
      </div>
    </div>
  );
}
