import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';

interface Notice { id: number; title: string; content: string; sent_alimtalk: boolean; created_at: string }

export default function Notices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', send_alimtalk: false });

  const load = () => api.get('/notices').then(r => setNotices(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/notices', form);
    setShowForm(false);
    setForm({ title: '', content: '', send_alimtalk: false });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.delete(`/notices/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">공지/소통</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 공지 작성
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">공지사항 작성</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="제목" className="w-full px-3 py-2 border rounded-lg outline-none" />
              <textarea required value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="내용" className="w-full px-3 py-2 border rounded-lg outline-none" rows={5} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.send_alimtalk} onChange={e => setForm({...form, send_alimtalk: e.target.checked})} className="rounded" />
                <span className="text-sm text-gray-700">카카오 알림톡으로 발송</span>
              </label>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg">발송</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {notices.map(n => (
          <div key={n.id} className="bg-white rounded-xl border p-5 group">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">{n.title}</h4>
                  {n.sent_alimtalk && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">알림톡 발송</span>}
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap mb-1">{n.content}</p>
                <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('ko-KR')}</p>
              </div>
              <button onClick={() => handleDelete(n.id)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded">
                <Trash2 size={14} className="text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {notices.length === 0 && <p className="text-center text-gray-500 py-8">공지사항이 없습니다.</p>}
      </div>
    </div>
  );
}
