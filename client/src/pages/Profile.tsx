import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI, orderAPI, Order } from '../services/api';

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    nickname: user?.nickname || '',
    phone: user?.phone || '',
  });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await orderAPI.getOrders();
        setOrders(res.data);
      } catch (error) {
        console.error('获取订单失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const handleSaveProfile = async () => {
    try {
      await authAPI.updateProfile(formData);
      updateUser(formData);
      setEditing(false);
    } catch (error) {
      console.error('更新资料失败:', error);
    }
  };

  const tabs = [
    { key: 'orders', label: '我的订单', icon: '🎫' },
    { key: 'profile', label: '个人信息', icon: '👤' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl">
            {user?.nickname?.[0] || user?.username?.[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{user?.nickname || user?.username}</h2>
            <p className="opacity-80 mt-1">@{user?.username}</p>
            {user?.role === 'admin' && (
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-xs">
                管理员
              </span>
            )}
          </div>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="ml-auto bg-white text-red-500 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              🔧 进入管理后台
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-red-500 border-red-500 font-medium'
                : 'text-gray-500 border-transparent hover:text-red-500'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <div>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
            </div>
          ) : orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map(order => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    <img
                      src={order.poster}
                      alt={order.movie_title}
                      className="w-16 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-lg">{order.movie_title}</h4>
                        <span className="text-green-500 text-sm font-medium">
                          {order.status === 'paid' ? '已支付' : order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{order.cinema_name}</p>
                      <p className="text-sm text-gray-500 mt-1">{order.start_time} · {order.hall}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        座位：{order.seats.join('、')}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400">{order.created_at}</p>
                        <p className="text-red-500 font-bold">¥{order.total_price}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500 bg-white rounded-xl">
              <div className="text-6xl mb-4">🎫</div>
              <p>暂无订单</p>
              <Link
                to="/movies"
                className="inline-block mt-4 text-red-500 hover:text-red-600"
              >
                去购票 →
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">个人信息</h3>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="text-red-500 hover:text-red-600 text-sm"
              >
                ✏️ 编辑
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setFormData({ nickname: user?.nickname || '', phone: user?.phone || '' });
                  }}
                  className="px-4 py-1 text-gray-500 hover:text-gray-700 text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                >
                  保存
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center py-3 border-b">
              <span className="w-24 text-gray-500">用户名</span>
              <span className="text-gray-800">{user?.username}</span>
            </div>
            <div className="flex items-center py-3 border-b">
              <span className="w-24 text-gray-500">昵称</span>
              {editing ? (
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                  className="input-field flex-1 max-w-xs"
                />
              ) : (
                <span className="text-gray-800">{user?.nickname || '-'}</span>
              )}
            </div>
            <div className="flex items-center py-3 border-b">
              <span className="w-24 text-gray-500">手机号</span>
              {editing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field flex-1 max-w-xs"
                />
              ) : (
                <span className="text-gray-800">{user?.phone || '-'}</span>
              )}
            </div>
            <div className="flex items-center py-3 border-b">
              <span className="w-24 text-gray-500">角色</span>
              <span className={`px-2 py-1 rounded text-xs ${
                user?.role === 'admin' 
                  ? 'bg-red-100 text-red-500' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {user?.role === 'admin' ? '管理员' : '普通用户'}
              </span>
            </div>
            <div className="flex items-center py-3">
              <span className="w-24 text-gray-500">注册时间</span>
              <span className="text-gray-800">{user?.created_at || '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
