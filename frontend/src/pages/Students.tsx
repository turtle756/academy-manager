import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit2, Nfc, XCircle } from 'lucide-react';
import api from '../lib/api';

interface Student {
  id: number;
  name: string;
  phone: string;
  parent_phone: string;
  parent_name: string;
  school: string;
  grade: string;
  nfc_uid: string | null;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', parent_phone: '', parent_name: '', school: '', grade: '' });
  const [nfcModal, setNfcModal] = useState<Student | null>(null);
  const [nfcStatus, setNfcStatus] = useState<'waiting' | 'success' | 'error' | 'unsupported'>('waiting');
  const [nfcMessage, setNfcMessage] = useState('');

  const load = () => api.get('/students').then(r => setStudents(r.data));
  useEffect(() => { load(); }, []);

  const filtered = students.filter(s =>
    s.name.includes(search) || s.phone?.includes(search) || s.parent_phone?.includes(search)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await api.patch(`/students/${editing.id}`, form);
    } else {
      await api.post('/students', form);
    }
    setForm({ name: '', phone: '', parent_phone: '', parent_name: '', school: '', grade: '' });
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleEdit = (s: Student) => {
    setForm({ name: s.name, phone: s.phone || '', parent_phone: s.parent_phone || '', parent_name: s.parent_name || '', school: s.school || '', grade: s.grade || '' });
    setEditing(s);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await api.delete(`/students/${id}`);
    load();
  };

  // NFC 등록 해제
  const unregisterNfc = async (student: Student) => {
    if (!confirm(`${student.name} 학생의 NFC 카드 등록을 해제할까요?`)) return;
    await api.post(`/students/${student.id}/unregister-nfc`);
    load();
  };

  // NFC 카드 등록 (Web NFC — Android Chrome에서만 동작)
  const startNfcRegister = async (student: Student) => {
    // 앱(WebView)에서 호출되는 경우 JS Bridge 사용
    if ((window as any).AndroidNfc) {
      (window as any).AndroidNfc.requestNfcScan(student.id, student.name);
      return;
    }

    setNfcModal(student);
    setNfcStatus('waiting');
    setNfcMessage('NFC 카드를 기기 뒷면에 터치하세요...');

    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported');
      setNfcMessage('이 기기에서 Web NFC를 지원하지 않습니다. 앱을 사용하세요.');
      return;
    }

    try {
      const ndef = new (window as any).NDEFReader();
      const abortController = new AbortController();
      await ndef.scan({ signal: abortController.signal });
      ndef.onreading = async (event: any) => {
        const uid = event.serialNumber?.replace(/:/g, '').toUpperCase();
        if (!uid) { setNfcStatus('error'); setNfcMessage('카드 UID를 읽을 수 없습니다'); return; }
        abortController.abort();
        try {
          await api.post(`/students/${student.id}/register-nfc?nfc_uid=${uid}`);
          setNfcStatus('success');
          setNfcMessage(`등록 완료! UID: ${uid}`);
          load();
        } catch (err: any) {
          setNfcStatus('error');
          setNfcMessage(err.response?.data?.detail || '등록 실패');
        }
      };
    } catch (err: any) {
      setNfcStatus('error');
      setNfcMessage(`NFC 오류: ${err.message}`);
    }
  };

  // 앱에서 NFC 결과 콜백 (JS Bridge)
  useEffect(() => {
    (window as any).onNfcResult = async (studentId: number, uid: string) => {
      try {
        await api.post(`/students/${studentId}/register-nfc?nfc_uid=${uid}`);
        alert(`NFC 등록 완료! (UID: ${uid})`);
        load();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'NFC 등록 실패');
      }
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">원생 관리</h2>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', phone: '', parent_phone: '', parent_name: '', school: '', grade: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus size={16} /> 원생 등록
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름, 전화번호로 검색"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">{editing ? '원생 수정' : '원생 등록'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="이름 *" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="학생 연락처" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} placeholder="학부모 이름" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} placeholder="학부모 연락처" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.school} onChange={e => setForm({...form, school: e.target.value})} placeholder="학교" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} placeholder="학년" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? '수정' : '등록'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NFC Register Modal */}
      {nfcModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold mb-2">NFC 카드 등록</h3>
            <p className="text-sm text-gray-500 mb-6">{nfcModal.name} 학생</p>
            <div className={`w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center ${
              nfcStatus === 'waiting' ? 'bg-blue-100 animate-pulse' : nfcStatus === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Nfc size={48} className={nfcStatus === 'waiting' ? 'text-blue-500' : nfcStatus === 'success' ? 'text-green-500' : 'text-red-500'} />
            </div>
            <p className={`text-sm mb-6 ${nfcStatus === 'success' ? 'text-green-600' : nfcStatus === 'error' || nfcStatus === 'unsupported' ? 'text-red-600' : 'text-gray-600'}`}>
              {nfcMessage}
            </p>
            <button onClick={() => setNfcModal(null)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
              {nfcStatus === 'success' ? '완료' : '취소'}
            </button>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">학교/학년</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">NFC</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.school} {s.grade}</td>
                <td className="px-4 py-3">
                  {s.nfc_uid ? (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                        <Nfc size={10} /> 등록됨
                      </span>
                      <button onClick={() => unregisterNfc(s)} className="p-1 hover:bg-red-50 rounded text-red-400" title="NFC 해제">
                        <XCircle size={12} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startNfcRegister(s)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-blue-100 hover:text-blue-600">
                      <Nfc size={10} /> 등록
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(s)} className="p-1.5 hover:bg-gray-100 rounded" title="수정"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="삭제"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-500 py-8">등록된 원생이 없습니다.</p>}
      </div>
    </div>
  );
}
