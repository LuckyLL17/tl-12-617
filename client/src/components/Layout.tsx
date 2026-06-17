import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCityStore } from '../store/cityStore';
import { useState, useEffect, useMemo } from 'react';
import { cinemaAPI, City } from '../services/api';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { selectedCity, selectedDistrict, setCity, setDistrict } = useCityStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCityModal, setShowCityModal] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string>('');

  useEffect(() => {
    cinemaAPI.getCities().then(res => setCities(res.data));
  }, []);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const navItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/movies', label: '电影', icon: '🎬' },
    { path: '/cinemas', label: '影院', icon: '🏢' },
  ];

  const groupedCities = useMemo(() => {
    const groups: { [key: string]: City[] } = {};
    cities.forEach(city => {
      const initial = city.initial || '#';
      if (!groups[initial]) {
        groups[initial] = [];
      }
      groups[initial].push(city);
    });
    return Object.keys(groups).sort().map(letter => ({
      letter,
      cities: groups[letter]
    }));
  }, [cities]);

  const letters = useMemo(() => groupedCities.map(g => g.letter), [groupedCities]);

  const scrollToLetter = (letter: string) => {
    setActiveLetter(letter);
    const element = document.getElementById(`city-group-${letter}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-md sticky top-0 z-50 flex-shrink-0 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2 group">
                <span className="text-2xl transform group-hover:scale-110 transition-transform">🎬</span>
                <span className="text-xl font-bold text-red-500 group-hover:text-red-600 transition-colors">淘票票</span>
              </Link>

              <nav className="hidden md:flex space-x-1">
                {navItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg transition-all duration-200 ${
                      location.pathname === item.path
                        ? 'text-red-500 bg-red-50 font-medium'
                        : 'text-gray-600 hover:text-red-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCityModal(true)}
                className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <span>📍</span>
                <span className="font-medium">{selectedCity}</span>
                {selectedDistrict && <span className="text-sm text-gray-400">· {selectedDistrict}</span>}
                <span className="text-xs text-gray-400">▼</span>
              </button>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 text-gray-600 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center text-white font-medium shadow-sm">
                      {user.nickname?.[0] || user.username[0]}
                    </div>
                    <span className="hidden md:inline font-medium">{user.nickname || user.username}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border py-2 z-50 animate-fade-in">
                      <Link
                        to="/profile"
                        className="flex items-center space-x-2 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <span>👤</span>
                        <span>个人中心</span>
                      </Link>
                      {user.role === 'admin' && (
                        <Link
                          to="/admin"
                          className="flex items-center space-x-2 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <span>🔧</span>
                          <span>管理后台</span>
                        </Link>
                      )}
                      <div className="border-t my-1"></div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-4 py-3 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <span>🚪</span>
                        <span>退出登录</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link to="/login" className="text-gray-600 hover:text-red-500 transition-colors font-medium">
                    登录
                  </Link>
                  <Link to="/register" className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium shadow-sm hover:shadow-md">
                    注册
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-gradient-to-br from-gray-800 to-gray-900 text-gray-400 py-10 mt-auto flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <span className="text-3xl">🎬</span>
              <div>
                <p className="text-white font-semibold text-lg">淘票票</p>
                <p className="text-sm text-gray-500">您的专属电影票务平台</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm">© 2026 Movie Ticket System. All rights reserved.</p>
              <p className="text-xs text-gray-500 mt-1">用心服务每一位影迷</p>
            </div>
          </div>
        </div>
      </footer>

      {showCityModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowCityModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="w-16 bg-gray-50 border-r flex flex-col items-center py-4 overflow-y-auto">
              {letters.map(letter => (
                <button
                  key={letter}
                  onClick={() => scrollToLetter(letter)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    activeLetter === letter
                      ? 'bg-red-500 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">选择城市</h3>
                <button
                  onClick={() => setShowCityModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">当前选择</p>
                <div className="flex items-center space-x-2">
                  <span className="bg-red-50 text-red-500 px-4 py-2 rounded-lg font-medium">
                    {selectedCity}
                    {selectedDistrict && ` · ${selectedDistrict}`}
                  </span>
                </div>
              </div>
              
              <div className="space-y-6">
                {groupedCities.map(group => (
                  <div key={group.letter} id={`city-group-${group.letter}`}>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {group.letter}
                      </span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 ml-10">
                      {group.cities.map(city => (
                        <button
                          key={city.city}
                          onClick={() => {
                            setCity(city.city);
                            setShowCityModal(false);
                          }}
                          className={`text-left px-4 py-2.5 rounded-lg transition-all text-sm ${
                            selectedCity === city.city && !selectedDistrict
                              ? 'bg-red-500 text-white shadow-md'
                              : 'bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          {city.city}
                        </button>
                      ))}
                    </div>
                    {selectedCity && group.cities.some(c => c.city === selectedCity) && (
                      <div className="ml-10 mt-3 p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-500 mb-2">选择区县</p>
                        <div className="flex flex-wrap gap-2">
                          {group.cities.find(c => c.city === selectedCity)?.districts.map(district => (
                            <button
                              key={district}
                              onClick={() => {
                                setDistrict(district);
                                setShowCityModal(false);
                              }}
                              className={`px-4 py-1.5 text-sm rounded-full border transition-all ${
                                selectedDistrict === district
                                  ? 'bg-red-500 text-white border-red-500 shadow-sm'
                                  : 'border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-500 bg-white'
                              }`}
                            >
                              {district}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
