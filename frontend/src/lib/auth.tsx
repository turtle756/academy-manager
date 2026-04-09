import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from './api';

interface User {
  id: number;
  email: string;
  name: string;
  picture: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  academyId: number | null;
  academyRole: string | null;
  academyName: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (saved && token) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    return !!(token && !saved);
  });

  const academyId = localStorage.getItem('academy_id') ? Number(localStorage.getItem('academy_id')) : null;
  const academyRole = localStorage.getItem('academy_role');
  const academyName = localStorage.getItem('academy_name');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.clear();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, academyId, academyRole, academyName, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
