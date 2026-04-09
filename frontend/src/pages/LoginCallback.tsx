import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function LoginCallback() {
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      const user = {
        id: Number(params.get('user_id')),
        email: params.get('email') || '',
        name: params.get('name') || '',
        picture: params.get('picture') || null,
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      const academyCount = Number(params.get('academy_count') || 0);
      const academyId = params.get('academy_id');

      if (academyCount === 1 && academyId) {
        // 학원 1개 → 바로 진입
        localStorage.setItem('academy_id', academyId);
        localStorage.setItem('academy_role', params.get('role') || '');
        window.location.href = '/';
      } else if (academyCount === 0) {
        // 학원 없음 → 학원 선택 (빠른 세팅 가능)
        window.location.href = '/select-academy';
      } else {
        // 학원 여러 개 → 선택
        window.location.href = '/select-academy';
      }
    } else {
      window.location.href = '/login';
    }
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
