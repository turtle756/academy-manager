import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

interface Invite { id: number; email: string; role: string; used: boolean; created_at: string }

export default function SettingsPage() {
  useAuth();
  const [form, setForm] = useState({ name: '', address: '', address_detail: '', phone: '', bank_name: '', bank_account: '', bank_holder: '' });
  const [saved, setSaved] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'teacher' });
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    api.get('/academies').then(r => {
      const d = r.data;
      setForm({ name: d.name || '', address: d.address || '', address_detail: d.address_detail || '', phone: d.phone || '', bank_name: d.bank_name || '', bank_account: d.bank_account || '', bank_holder: d.bank_holder || '' });
    }).catch(() => {});
    loadInvites();
  }, []);

  const loadInvites = () => api.get('/invitations').then(r => setInvites(r.data)).catch(() => {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.patch('/academies', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/invitations', inviteForm);
      setInviteForm({ email: '', role: 'teacher' });
      setShowInvite(false);
      loadInvites();
    } catch (err: any) {
      alert(err.response?.data?.detail || '초대 실패');
    }
  };

  const handleDeleteInvite = async (id: number) => {
    await api.delete(`/invitations/${id}`);
    loadInvites();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">설정</h2>

      {/* Academy info */}
      <div className="bg-white rounded-xl border p-6 max-w-lg">
        <h3 className="text-lg font-semibold mb-4">학원 정보</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학원 이름</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <div className="flex gap-2">
              <input value={form.address} readOnly onClick={() => { new (window as any).daum.Postcode({ oncomplete: (data: any) => { setForm({...form, address: data.roadAddress || data.jibunAddress}); } }).open(); }} className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-gray-50" placeholder="클릭하여 주소 검색" />
              <button type="button" onClick={() => { new (window as any).daum.Postcode({ oncomplete: (data: any) => { setForm({...form, address: data.roadAddress || data.jibunAddress}); } }).open(); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm whitespace-nowrap">주소 검색</button>
            </div>
            {form.address && (
              <input value={form.address_detail} onChange={e => setForm({...form, address_detail: e.target.value})} className="w-full mt-2 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="상세주소 (동/호수 등)" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <hr />
          <p className="text-sm text-gray-500">학원비 입금 계좌</p>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="은행" className="px-3 py-2 border rounded-lg outline-none" />
            <input value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} placeholder="계좌번호" className="px-3 py-2 border rounded-lg outline-none" />
            <input value={form.bank_holder} onChange={e => setForm({...form, bank_holder: e.target.value})} placeholder="예금주" className="px-3 py-2 border rounded-lg outline-none" />
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {saved ? '저장됨!' : '저장'}
          </button>
        </form>
      </div>

      {/* Staff management */}
      <div className="bg-white rounded-xl border p-6 max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">구성원 초대</h3>
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <UserPlus size={14} /> 초대
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          초대할 사람의 Google 이메일을 등록하면, 해당 이메일로 로그인 시 자동으로 이 학원에 배정됩니다.
        </p>

        {showInvite && (
          <form onSubmit={handleInvite} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
            <input
              required
              type="email"
              value={inviteForm.email}
              onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
              placeholder="Google 이메일 주소"
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={inviteForm.role}
              onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg outline-none"
            >
              <option value="teacher">강사</option>
              <option value="owner">관리자 (원장급)</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm">초대</button>
              <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 border rounded-lg text-sm">취소</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {invites.map(inv => (
            <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg">
              <div>
                <span className="text-sm font-medium">{inv.email}</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  inv.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {inv.role === 'owner' ? '관리자' : '강사'}
                </span>
                {inv.used && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">가입 완료</span>}
              </div>
              {!inv.used && (
                <button onClick={() => handleDeleteInvite(inv.id)} className="p-1.5 hover:bg-red-50 rounded">
                  <Trash2 size={14} className="text-red-500" />
                </button>
              )}
            </div>
          ))}
          {invites.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">초대된 구성원이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
