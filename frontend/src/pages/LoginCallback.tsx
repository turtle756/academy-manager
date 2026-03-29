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
        role: params.get('role') || 'owner',
        academy_id: params.get('academy_id') ? Number(params.get('academy_id')) : null,
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      // Full page reload so AuthProvider picks up the token
      window.location.href = user.academy_id ? '/' : '/setup';
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
