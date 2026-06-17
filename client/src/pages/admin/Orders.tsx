import { useState, useEffect } from 'react';
import { orderAPI, Order } from '../../services/api';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await orderAPI.getOrders();
      setOrders(res.data);
    } catch (error) {
      console.error('获取订单列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await orderAPI.updateOrderStatus(id, status);
      fetchOrders();
    } catch (error: any) {
      alert(error.response?.data?.message || '更新失败');
    }
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.status === filter);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  const statusOptions = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待支付' },
    { key: 'paid', label: '已支付' },
    { key: 'refunded', label: '已退款' },
    { key: 'cancelled', label: '已取消' },
  ];

  const statusBadge: { [key: string]: string } = {
    pending: 'bg-orange-100 text-orange-600',
    paid: 'bg-green-100 text-green-600',
    refunded: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
  };

  const statusText: { [key: string]: string } = {
    pending: '待支付',
    paid: '已支付',
    refunded: '已退款',
    cancelled: '已取消',
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🎫 订单管理</h1>
        <div className="flex gap-2">
          {statusOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filter === opt.key
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">订单号</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">电影</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">影院</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">场次</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">座位</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">金额</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.map(order => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono">{order.id.slice(0, 8)}...</td>
                <td className="px-4 py-3 font-medium">{order.movie_title}</td>
                <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">{order.cinema_name}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{order.start_time}</td>
                <td className="px-4 py-3 text-gray-600">{Array.isArray(order.seats) ? order.seats.join('、') : order.seats}</td>
                <td className="px-4 py-3 text-red-500 font-medium">¥{order.total_price}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusBadge[order.status]}`}>
                    {statusText[order.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'paid')}
                        className="text-green-500 hover:text-green-600 text-sm"
                      >
                        确认支付
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        className="text-red-500 hover:text-red-600 text-sm"
                      >
                        取消
                      </button>
                    </div>
                  )}
                  {order.status === 'paid' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'refunded')}
                        className="text-yellow-500 hover:text-yellow-600 text-sm"
                      >
                        退款
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        className="text-red-500 hover:text-red-600 text-sm"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-20 text-gray-500 bg-white rounded-xl mt-4">
          <div className="text-6xl mb-4">🎫</div>
          <p>暂无订单</p>
        </div>
      )}
    </div>
  );
}
