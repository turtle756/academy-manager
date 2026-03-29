import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function SettingsPage() {
  useAuth();
  const [form, setForm] = useState({ name: '', address: '', phone: '', bank_name: '', bank_account: '', bank_holder: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/academies').then(r => {
      const d = r.data;
      setForm({ name: d.name || '', address: d.address || '', phone: d.phone || '', bank_name: d.bank_name || '', bank_account: d.bank_account || '', bank_holder: d.bank_holder || '' });
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.patch('/academies', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">설정</h2>

      <div className="bg-white rounded-xl border p-6 max-w-lg">
        <h3 className="text-lg font-semibold mb-4">학원 정보</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학원 이름</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
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
    </div>
  );
}
