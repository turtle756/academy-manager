import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function JoinAcademy() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // 로그인 안 된 상태 → 로그인 후 돌아오도록 저장
      localStorage.setItem('pending_invite', code || '');
      navigate('/login');
      return;
    }
    api.post(`/auth/join/${code}`)
      .then(res => {
        const { academy_id, academy_name, role } = res.data;
        localStorage.setItem('academy_id', String(academy_id));
        localStorage.setItem('academy_role', role);
        localStorage.setItem('academy_name', academy_name);
        setStatus('success');
        setMessage(academy_name);
        setTimeout(() => { window.location.href = '/'; }, 1500);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.detail || '유효하지 않은 초대 링크입니다');
      });
  }, [code]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-500">초대 링크 확인 중...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✓</div>
            <p className="font-bold text-gray-900 text-lg mb-1">{message}</p>
            <p className="text-sm text-gray-500">학원에 합류했습니다. 이동 중...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">✗</div>
            <p className="font-bold text-red-600 mb-2">초대 링크 오류</p>
            <p className="text-sm text-gray-500 mb-4">{message}</p>
            <button onClick={() => navigate('/select-academy')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              학원 선택으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
