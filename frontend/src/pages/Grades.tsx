import { useEffect, useState } from 'react';
import { Plus, Save, X, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../lib/api';

interface Grade {
  id: number;
  student_id: number;
  student_name: string;
  classroom_id: number;
  exam_name: string;
  exam_type: string;
  score: number;
  total_score: number;
  date: string;
}

interface Classroom {
  id: number;
  name: string;
  students?: { student: { id: number; name: string } }[];
}

const EXAM_TYPES = [
  { key: 'all', label: '전체' },
  { key: 'school', label: '내신' },
  { key: 'mock', label: '모의고사' },
  { key: 'academy', label: '학원테스트' },
];

const EXAM_TYPE_LABELS: Record<string, string> = {
  school: '내신',
  mock: '모의고사',
  academy: '학원테스트',
};

const LINE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

export default function Grades() {
  const today = new Date().toISOString().slice(0, 10);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [filterClassroom, setFilterClassroom] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [showTrend, setShowTrend] = useState(false);

  const [showInput, setShowInput] = useState(false);
  const [inputForm, setInputForm] = useState({
    classroom_id: 0,
    exam_name: '',
    exam_type: 'academy',
    total_score: 100,
    date: today,
  });
  const [scores, setScores] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get('/classrooms').then(r => setClassrooms(r.data));
    loadGrades();
  }, []);

  const loadGrades = () => {
    const params: Record<string, any> = {};
    if (filterClassroom) params.classroom_id = filterClassroom;
    api.get('/grades', { params }).then(r => setGrades(r.data));
  };

  useEffect(() => { loadGrades(); }, [filterClassroom]);

  const openInputMode = () => {
    setInputForm({ classroom_id: 0, exam_name: '', exam_type: 'academy', total_score: 100, date: today });
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
    const scoreEntries = Object.entries(scores).filter(([, v]) => v !== '' && v !== undefined);
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
          exam_type: inputForm.exam_type,
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

  // 필터링
  const filteredGrades = grades.filter(g =>
    filterType === 'all' ? true : g.exam_type === filterType
  );

  // 그룹핑: 반 + 시험명 + 날짜
  const groupedGrades = filteredGrades.reduce<Record<string, Grade[]>>((acc, g) => {
    const key = `${g.classroom_id}__${g.exam_name}__${g.date}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groupedGrades).sort((a, b) =>
    b[1][0]?.date.localeCompare(a[1][0]?.date)
  );

  // 추이 그래프 데이터 — 학생별 점수를 시험 날짜 순으로
  const buildTrendData = () => {
    const src = filterClassroom
      ? filteredGrades.filter(g => g.classroom_id === filterClassroom)
      : filteredGrades;

    // 날짜 순 정렬
    const sorted = [...src].sort((a, b) => a.date.localeCompare(b.date));

    // x축: 날짜__시험명 조합
    const xKeys = Array.from(new Set(sorted.map(g => `${g.date} ${g.exam_name}`))).sort();

    // 학생 목록
    const studentNames = Array.from(new Set(sorted.map(g => g.student_name)));

    // 데이터 포인트 조립
    return {
      data: xKeys.map(xKey => {
        const row: Record<string, any> = { label: xKey };
        studentNames.forEach(name => {
          const match = sorted.find(g => `${g.date} ${g.exam_name}` === xKey && g.student_name === name);
          if (match) row[name] = Math.round((match.score / match.total_score) * 100);
        });
        return row;
      }),
      studentNames,
    };
  };

  const { data: trendData, studentNames } = buildTrendData();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">성적 관리</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTrend(!showTrend)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${showTrend ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600'}`}
          >
            <TrendingUp size={14} /> 추이
          </button>
          <button
            onClick={openInputMode}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus size={16} /> 성적 입력
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filterClassroom || ''}
          onChange={e => setFilterClassroom(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">전체 반</option>
          {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="flex gap-1">
          {EXAM_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setFilterType(t.key)}
              className={`px-3 py-2 rounded-lg text-sm ${filterType === t.key ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 추이 그래프 */}
      {showTrend && trendData.length > 0 && (
        <div className="bg-white rounded-xl border p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            점수 추이 (%)
            {filterType !== 'all' && <span className="ml-2 text-gray-400">{EXAM_TYPE_LABELS[filterType]}</span>}
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {studentNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
                      required type="date"
                      value={inputForm.date}
                      onChange={e => setInputForm({...inputForm, date: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">시험 유형 *</label>
                  <div className="flex gap-2">
                    {[
                      { key: 'school', label: '내신' },
                      { key: 'mock', label: '모의고사' },
                      { key: 'academy', label: '학원테스트' },
                    ].map(t => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setInputForm({...inputForm, exam_type: t.key})}
                        className={`px-4 py-2 rounded-lg text-sm border ${inputForm.exam_type === t.key ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">시험 이름 *</label>
                    <input
                      required
                      value={inputForm.exam_name}
                      onChange={e => setInputForm({...inputForm, exam_name: e.target.value})}
                      placeholder={inputForm.exam_type === 'school' ? '예: 1학기 중간고사' : inputForm.exam_type === 'mock' ? '예: 4월 모의고사' : '예: 3월 단어시험'}
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
              <button type="button" onClick={() => setShowInput(false)} className="flex-1 py-2.5 border rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleSubmit} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <Save size={16} /> 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 성적 목록 */}
      <div className="space-y-4">
        {sortedGroups.map(([key, items]) => {
          const first = items[0];
          const classroom = classrooms.find(c => c.id === first.classroom_id);
          const typeLabel = EXAM_TYPE_LABELS[first.exam_type] || first.exam_type;
          const avg = Math.round(items.reduce((s, g) => s + g.score / g.total_score * 100, 0) / items.length);
          return (
            <div key={key} className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b flex items-center gap-3 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  first.exam_type === 'school' ? 'bg-blue-100 text-blue-700' :
                  first.exam_type === 'mock' ? 'bg-purple-100 text-purple-700' :
                  'bg-green-100 text-green-700'
                }`}>{typeLabel}</span>
                <span className="font-semibold text-gray-900">{first.exam_name}</span>
                <span className="text-sm text-gray-500">{classroom?.name || '-'}</span>
                <span className="text-xs text-gray-400 ml-auto">{first.date}</span>
                <span className="text-xs text-gray-500">평균 {avg}%</span>
              </div>
              <div className="divide-y">
                {items.sort((a, b) => b.score - a.score).map((g, idx) => {
                  const pct = Math.round(g.score / g.total_score * 100);
                  return (
                    <div key={g.id} className="px-5 py-2.5 flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
                      <span className="flex-1 text-sm text-gray-900">{g.student_name}</span>
                      <div className="w-24 bg-gray-100 rounded-full h-1.5 hidden md:block">
                        <div
                          className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-gray-700 text-sm">{g.score}<span className="text-gray-400">/{g.total_score}</span></span>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
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
