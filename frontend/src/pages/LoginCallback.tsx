import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      const user = {
        id: Number(params.get('user_id')),
        email: params.get('email') || '',
        name: params.get('name') || '',
        picture: params.get('picture') || null,
        role: (params.get('role') || 'owner') as 'owner' | 'teacher',
        academy_id: params.get('academy_id') ? Number(params.get('academy_id')) : null,
      };
      login(token, user);
      navigate(user.academy_id ? '/' : '/setup');
    } else {
      navigate('/login');
    }
  }, [params, login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
