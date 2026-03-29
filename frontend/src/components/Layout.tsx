import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  LayoutDashboard, UserCheck, Users, Calendar, CreditCard,
  GraduationCap, MessageSquare, Bell, FileText, BarChart3,
  Settings, LogOut, Menu
} from 'lucide-react';
import { useState } from 'react';

const ownerNav = [
  { to: '/', icon: LayoutDashboard, label: '대시보드' },
  { to: '/attendance', icon: UserCheck, label: '출결 관리' },
  { to: '/students', icon: Users, label: '원생 관리' },
  { to: '/classrooms', icon: GraduationCap, label: '반 관리' },
  { to: '/schedules', icon: Calendar, label: '시간표' },
  { to: '/payments', icon: CreditCard, label: '수납 관리' },
  { to: '/grades', icon: BarChart3, label: '성적 관리' },
  { to: '/counseling', icon: MessageSquare, label: '상담일지' },
  { to: '/notices', icon: Bell, label: '공지/소통' },
  { to: '/documents', icon: FileText, label: '서류 생성' },
  { to: '/stats', icon: BarChart3, label: '통계' },
  { to: '/settings', icon: Settings, label: '설정' },
];

const teacherNav = [
  { to: '/', icon: LayoutDashboard, label: '내 수업' },
  { to: '/attendance', icon: UserCheck, label: '출석 시작' },
  { to: '/grades', icon: BarChart3, label: '성적 입력' },
  { to: '/counseling', icon: MessageSquare, label: '상담일지' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = user?.role === 'owner' ? ownerNav : teacherNav;

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">학원 관리</h1>
          {user && <p className="text-sm text-gray-500 mt-1">{user.name}</p>}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 w-full"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold">학원 관리</h1>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
