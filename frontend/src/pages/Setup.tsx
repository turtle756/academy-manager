import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import api from '../lib/api';

export default function Setup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    address: '',
    address_detail: '',
    phone: '',
    bank_name: '',
    bank_account: '',
    bank_holder: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academies', form);
      // Refresh user data
      const res = await api.get('/auth/me');
      login(localStorage.getItem('token')!, res.data);
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-lg w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">학원 정보 등록</h1>
        <p className="text-gray-500 mb-6">학원 기본 정보를 입력해주세요.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학원 이름 *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="OO학원"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <div className="flex gap-2">
              <input
                value={form.address}
                readOnly
                onClick={() => {
                  new (window as any).daum.Postcode({
                    oncomplete: (data: any) => {
                      setForm({ ...form, address: data.roadAddress || data.jibunAddress });
                    },
                  }).open();
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer bg-gray-50"
                placeholder="클릭하여 주소 검색"
              />
              <button
                type="button"
                onClick={() => {
                  new (window as any).daum.Postcode({
                    oncomplete: (data: any) => {
                      setForm({ ...form, address: data.roadAddress || data.jibunAddress });
                    },
                  }).open();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm whitespace-nowrap"
              >
                주소 검색
              </button>
            </div>
            {form.address && (
              <input
                value={form.address_detail}
                onChange={(e) => setForm({ ...form, address_detail: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="상세주소 (동/호수 등)"
                autoFocus
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="02-1234-5678"
            />
          </div>

          <hr className="my-4" />
          <p className="text-sm text-gray-500">학원비 입금 계좌 (학부모에게 안내됩니다)</p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">은행</label>
              <input
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="국민은행"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
              <input
                value={form.bank_account}
                onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="123-456-789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
              <input
                value={form.bank_holder}
                onChange={(e) => setForm({ ...form, bank_holder: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="홍길동"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors mt-6"
          >
            등록하고 시작하기
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-dashed">
          <button
            onClick={async () => {
              try {
                await api.post('/auth/quick-setup');
                const res = await api.get('/auth/me');
                login(localStorage.getItem('token')!, res.data);
                window.location.href = '/';
              } catch (err) { console.error(err); }
            }}
            className="w-full py-2 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50"
          >
            테스트용 빠른 세팅 (학원 + 원생 1명 자동 생성)
          </button>
        </div>
      </div>
    </div>
  );
}
