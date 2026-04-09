import { useEffect, useState } from 'react';
import { Building2, LogOut } from 'lucide-react';
import api from '../lib/api';

interface AcademyItem {
  academy_id: number;
  name: string;
  role: string;
  joined_at: string;
}

const roleLabel: Record<string, string> = { owner: '원장', teacher: '강사' };

export default function SelectAcademy() {
  const [academies, setAcademies] = useState<AcademyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const userName = JSON.parse(localStorage.getItem('user') || '{}').name || '';

  useEffect(() => {
    api.get('/academies/my')
      .then(r => setAcademies(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectAcademy = (a: AcademyItem) => {
    localStorage.setItem('academy_id', String(a.academy_id));
    localStorage.setItem('academy_role', a.role);
    localStorage.setItem('academy_name', a.name);
    window.location.href = '/';
  };

  const quickSetup = async () => {
    try {
      const res = await api.post('/auth/quick-setup');
      localStorage.setItem('academy_id', String(res.data.academy_id));
      localStorage.setItem('academy_role', 'owner');
      localStorage.setItem('academy_name', '테스트 학원');
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">학원 선택</h1>
            <p className="text-sm text-gray-500 mt-1">{userName}</p>
          </div>
          <button onClick={logout} className="p-2 hover:bg-gray-100 rounded-lg" title="로그아웃">
            <LogOut size={18} className="text-gray-400" />
          </button>
        </div>

        {academies.length > 0 ? (
          <div className="space-y-3 mb-6">
            {academies.map(a => (
              <button
                key={a.academy_id}
                onClick={() => selectAcademy(a)}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Building2 size={24} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{a.name}</p>
                  <p className="text-sm text-gray-500">{roleLabel[a.role] || a.role}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 mb-6">
            <Building2 size={48} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">소속된 학원이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">초대 링크를 받았다면 해당 링크로 접속하세요</p>
          </div>
        )}

        <div className="border-t pt-4">
          <button
            onClick={quickSetup}
            className="w-full py-2.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50"
          >
            테스트용 빠른 세팅 (학원 + 원생 5명 자동 생성)
          </button>
        </div>
      </div>
    </div>
  );
}
