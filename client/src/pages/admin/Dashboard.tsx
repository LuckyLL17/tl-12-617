import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await adminAPI.getStats();
        setStats(res.data);
      } catch (error) {
        console.error('获取统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: '电影总数', value: stats?.movies || 0, icon: '🎬', color: 'from-blue-500 to-blue-600' },
    { label: '影院总数', value: stats?.cinemas || 0, icon: '🏢', color: 'from-green-500 to-green-600' },
    { label: '排片总数', value: stats?.schedules || 0, icon: '📅', color: 'from-purple-500 to-purple-600' },
    { label: '用户总数', value: stats?.users || 0, icon: '👥', color: 'from-yellow-500 to-yellow-600' },
    { label: '订单总数', value: stats?.orders || 0, icon: '🎫', color: 'from-red-500 to-red-600' },
    { label: '累计票房', value: `¥${stats?.revenue?.toFixed(2) || 0}`, icon: '💰', color: 'from-pink-500 to-pink-600' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📊 数据概览</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${card.color} text-white rounded-xl p-4 shadow-lg`}
          >
            <div className="text-3xl mb-2">{card.icon}</div>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-sm opacity-90">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">📈 近7天订单趋势</h2>
        {stats?.last7Days?.length > 0 ? (
          <div className="space-y-3">
            {stats.last7Days.map((day: any, index: number) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-500">{day.date}</div>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden flex items-center px-3">
                  <div
                    className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-lg transition-all"
                    style={{ width: `${(day.count / Math.max(...stats.last7Days.map((d: any) => d.count))) * 100}%`, minWidth: day.count > 0 ? '40px' : '0' }}
                  />
                </div>
                <div className="w-20 text-sm text-gray-600 text-right">{day.count} 单</div>
                <div className="w-24 text-sm text-red-500 font-medium text-right">¥{day.revenue.toFixed(2)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <p>近7天暂无订单数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
