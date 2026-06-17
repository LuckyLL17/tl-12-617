import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/admin', label: '数据概览', icon: '📊' },
    { path: '/admin/movies', label: '电影管理', icon: '🎬' },
    { path: '/admin/cinemas', label: '影院管理', icon: '🏢' },
    { path: '/admin/schedules', label: '排片管理', icon: '📅' },
    { path: '/admin/orders', label: '订单管理', icon: '🎫' },
    { path: '/admin/users', label: '用户管理', icon: '👥' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">🎬</span>
            <span className="text-xl font-bold">淘票票后台</span>
          </Link>
        </div>
        
        <nav className="flex-1 py-4">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                location.pathname === item.path
                  ? 'bg-red-500 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center font-bold">
              {user?.nickname?.[0] || user?.username?.[0]}
            </div>
            <div>
              <p className="font-medium">{user?.nickname || user?.username}</p>
              <p className="text-xs text-gray-400">管理员</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-center py-2 rounded-lg text-sm transition-colors"
            >
              返回前台
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 bg-red-500 hover:bg-red-600 text-center py-2 rounded-lg text-sm transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
