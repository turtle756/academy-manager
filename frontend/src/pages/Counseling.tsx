import { useEffect, useState } from 'react';
import { Plus, Trash2, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';

type CounselingType = 'regular' | 'parent' | 'retention' | 'new_enrollment';
type CounselingStatus = 'scheduled' | 'completed';

interface CounselingRecord {
  id: number;
  student_id: number;
  student_name: string;
  teacher_name: string;
  date: string;
  counseling_type: CounselingType;
  status: CounselingStatus;
  title: string | null;
  issue: string | null;
  agreement: string | null;
  followup: string | null;
  result: string | null;
  next_date: string | null;
}

const TYPE_META: Record<CounselingType, { label: string; color: string; issueLabel: string; hasNextDate: boolean; hasResult: boolean }> = {
  regular:        { label: '정기 상담',     color: 'bg-blue-100 text-blue-700',   issueLabel: '현재 학습 상태',    hasNextDate: true,  hasResult: false },
  parent:         { label: '학부모 상담',   color: 'bg-purple-100 text-purple-700', issueLabel: '학부모 요구사항',   hasNextDate: false, hasResult: false },
  retention:      { label: '퇴원방지 상담', color: 'bg-red-100 text-red-700',     issueLabel: '이탈 징후',         hasNextDate: false, hasResult: false },
  new_enrollment: { label: '신규 등록 상담', color: 'bg-green-100 text-green-700', issueLabel: '학생 정보 및 요구사항', hasNextDate: false, hasResult: true },
};

const RESULT_OPTIONS = ['등록 완료', '보류', '거절'];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  student_id: '', date: today(), counseling_type: 'regular' as CounselingType,
  status: 'scheduled' as CounselingStatus,
  title: '', issue: '', agreement: '', followup: '', result: '', next_date: '',
});

export default function Counseling() {
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [students, setStudents] = useState<{ id: number; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = () => api.get('/counseling').then(r => setRecords(r.data));
  useEffect(() => { load(); api.get('/students').then(r => setStudents(r.data)); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/counseling', {
      ...form,
      student_id: Number(form.student_id),
      title: form.title || null,
      issue: form.issue || null,
      agreement: form.agreement || null,
      followup: form.followup || null,
      result: form.result || null,
      next_date: form.next_date || null,
    });
    setShowForm(false);
    setForm(emptyForm());
    load();
  };

  const markCompleted = async (r: CounselingRecord) => {
    await api.patch(`/counseling/${r.id}`, { status: 'completed' });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.delete(`/counseling/${id}`);
    load();
  };

  const meta = TYPE_META[form.counseling_type];
  const scheduled = records.filter(r => r.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  const completed = records.filter(r => r.status === 'completed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">상담일지</h2>
        <button onClick={() => { setForm(emptyForm()); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 상담 등록
        </button>
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">상담 등록</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">학생 *</label>
                  <select required value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                    <option value="">선택</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">날짜 *</label>
                  <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">상담 유형</label>
                  <select value={form.counseling_type} onChange={e => setForm({...form, counseling_type: e.target.value as CounselingType, result: ''})} className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                    {(Object.keys(TYPE_META) as CounselingType[]).map(k => (
                      <option key={k} value={k}>{TYPE_META[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">상태</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value as CounselingStatus})} className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                    <option value="scheduled">예정</option>
                    <option value="completed">완료</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">제목 (선택)</label>
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder={`예: ${meta.label} - ${students.find(s => String(s.id) === form.student_id)?.name || '학생명'}`} className="w-full px-3 py-2 border rounded-lg outline-none text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{meta.issueLabel}</label>
                <textarea value={form.issue} onChange={e => setForm({...form, issue: e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg outline-none text-sm resize-none" placeholder={
                  form.counseling_type === 'regular' ? '성적 추이, 수업 태도, 숙제 이행 여부 등' :
                  form.counseling_type === 'parent' ? '학부모가 제기한 요구사항이나 불만' :
                  form.counseling_type === 'retention' ? '결석 횟수, 성적 급락, 불만 징후 등' :
                  '학교/학년/현재 성적/학습 목표/학부모 기대치'
                } />
              </div>

              {form.status === 'completed' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">합의 내용</label>
                    <textarea value={form.agreement} onChange={e => setForm({...form, agreement: e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg outline-none text-sm resize-none" placeholder="상담을 통해 합의된 내용" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">후속 조치</label>
                    <textarea value={form.followup} onChange={e => setForm({...form, followup: e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg outline-none text-sm resize-none" placeholder="담당 교사가 취할 후속 조치" />
                  </div>
                  {meta.hasResult && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">상담 결과</label>
                      <select value={form.result} onChange={e => setForm({...form, result: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none text-sm">
                        <option value="">선택</option>
                        {RESULT_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                  {meta.hasNextDate && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">다음 상담 예정일</label>
                      <input type="date" value={form.next_date} onChange={e => setForm({...form, next_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none text-sm" />
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm">저장</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 예정된 상담 */}
      {scheduled.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock size={14} /> 예정된 상담 ({scheduled.length})
          </h3>
          <div className="space-y-2">
            {scheduled.map(r => {
              const m = TYPE_META[r.counseling_type] || TYPE_META.regular;
              const isPast = r.date < today();
              return (
                <div key={r.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${isPast ? 'border-orange-200 bg-orange-50' : ''}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{r.student_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.color}`}>{m.label}</span>
                      <span className="text-sm text-gray-400">{r.date}</span>
                      {isPast && <span className="text-xs text-orange-600 font-medium">기한 지남</span>}
                    </div>
                    {r.title && <p className="text-sm text-gray-500 mt-1">{r.title}</p>}
                    {r.issue && <p className="text-xs text-gray-400 mt-0.5 truncate">{m.issueLabel}: {r.issue}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => markCompleted(r)} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs hover:bg-green-200 font-medium">
                      <CheckCircle size={12} /> 완료
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 hover:bg-red-50 rounded ml-1">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 완료된 상담 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <CheckCircle size={14} /> 완료된 상담 ({completed.length})
        </h3>
        <div className="space-y-2">
          {completed.map(r => {
            const m = TYPE_META[r.counseling_type] || TYPE_META.regular;
            const expanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-white rounded-xl border overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{r.student_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.color}`}>{m.label}</span>
                      {r.result && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.result === '등록 완료' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.result}</span>}
                      <span className="text-sm text-gray-400">{r.date}</span>
                      <span className="text-xs text-gray-400">by {r.teacher_name}</span>
                    </div>
                    {r.title && <p className="text-sm text-gray-600 mt-0.5">{r.title}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    <button onClick={e => { e.stopPropagation(); handleDelete(r.id); }} className="p-1 hover:bg-red-50 rounded">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t bg-gray-50 space-y-3 pt-3">
                    {r.issue && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">{m.issueLabel}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.issue}</p>
                      </div>
                    )}
                    {r.agreement && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">합의 내용</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.agreement}</p>
                      </div>
                    )}
                    {r.followup && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">후속 조치</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.followup}</p>
                      </div>
                    )}
                    {r.next_date && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">다음 상담 예정일</p>
                        <p className="text-sm text-blue-600 font-medium">{r.next_date}</p>
                      </div>
                    )}
                    {!r.issue && !r.agreement && !r.followup && !r.next_date && (
                      <p className="text-sm text-gray-400">기록된 내용이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {completed.length === 0 && scheduled.length === 0 && (
            <p className="text-center text-gray-400 py-8">상담 기록이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
