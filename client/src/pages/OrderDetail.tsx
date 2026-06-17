import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { orderAPI, Order } from '../services/api';
import PageHeader from '../components/PageHeader';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      try {
        const res = await orderAPI.getOrder(id);
        setOrder(res.data);
      } catch (error) {
        console.error('获取订单详情失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  /**
   * 取消待支付订单
   * 取消后座位会被释放，订单状态变为 cancelled
   */
  const handleCancel = async () => {
    if (!id || !order) return;
    if (!confirm('确定要取消此订单吗？取消后座位将被释放。')) return;

    setCancelling(true);
    try {
      await orderAPI.cancelOrder(id);
      // 刷新订单详情
      const res = await orderAPI.getOrder(id);
      setOrder(res.data);
    } catch (error: any) {
      alert(error.response?.data?.message || '取消订单失败');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-6xl mb-4">😢</div>
        <p>订单不存在</p>
      </div>
    );
  }

  // 订单状态配置：包含 pending（待支付）状态
  const statusText: { [key: string]: { text: string; color: string; icon: string; bgColor: string } } = {
    pending: { text: '待支付', color: 'text-orange-500', icon: '⏳', bgColor: 'from-orange-500 to-orange-600' },
    paid: { text: '已支付', color: 'text-green-500', icon: '✅', bgColor: 'from-green-500 to-green-600' },
    refunded: { text: '已退款', color: 'text-gray-500', icon: '↩️', bgColor: 'from-gray-500 to-gray-600' },
    cancelled: { text: '已取消', color: 'text-red-500', icon: '❌', bgColor: 'from-red-400 to-red-500' },
  };

  const status = statusText[order.status] || statusText.paid;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader 
        title="订单详情" 
        subtitle={order ? `${order.movie_title} · ${order.hall}` : '订单详情'}
      />
      
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        {/* 顶部状态横幅 - 根据订单状态显示不同颜色 */}
        <div className={`bg-gradient-to-r ${status.bgColor} text-white p-8 text-center`}>
          <div className="text-6xl mb-4">{status.icon}</div>
          <h2 className="text-2xl font-bold">
            {order.status === 'pending' ? '待支付' :
             order.status === 'paid' ? '购票成功' :
             order.status === 'cancelled' ? '订单已取消' :
             order.status === 'refunded' ? '已退款' : '订单详情'}
          </h2>
          <p className="mt-2 opacity-90">
            {order.status === 'pending' ? '请尽快完成支付，超时订单将自动取消' :
             order.status === 'paid' ? '请提前15分钟到影院取票' :
             order.status === 'cancelled' ? '座位已释放，可重新选座购票' : ''}
          </p>
        </div>

        <div className="p-6">
          <div className="flex gap-4 mb-6 pb-6 border-b">
            <img
              src={order.poster}
              alt={order.movie_title}
              className="w-24 h-36 object-cover rounded-lg"
            />
            <div className="flex-1">
              <h3 className="text-xl font-bold">{order.movie_title}</h3>
              <p className={`mt-2 font-medium ${status.color}`}>
                {status.icon} {status.text}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">影院</span>
              <span className="font-medium">{order.cinema_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">场次</span>
              <span className="font-medium">{order.start_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">影厅</span>
              <span className="font-medium">{order.hall}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">座位</span>
              <span className="font-medium">{order.seats.join('、')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">时长</span>
              <span className="font-medium">{order.duration}分钟</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">数量</span>
              <span className="font-medium">{order.seats.length}张</span>
            </div>
            <div className="flex justify-between pt-4 border-t">
              <span className="text-gray-500">订单金额</span>
              <span className="text-xl font-bold text-red-500">¥{order.total_price}</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500">订单号：{order.id}</p>
            <p className="text-sm text-gray-500 mt-1">下单时间：{order.created_at}</p>
          </div>

          {/* 已支付订单显示取票二维码 */}
          {order.status === 'paid' && (
            <div className="flex flex-col items-center mt-6 p-6 bg-gray-50 rounded-xl">
              <h4 className="font-semibold text-gray-800 mb-4">🎫 取票二维码</h4>
              <div className="bg-white p-4 rounded-xl shadow-inner">
                <QRCodeSVG
                  value={`movie-ticket://${order.id}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-sm text-gray-500 mt-3 text-center max-w-xs">
                请在开场前15分钟到影院自助取票机扫描此二维码，或输入订单号取票
              </p>
              <div className="mt-2 text-center">
                <p className="text-xs text-gray-400">订单号</p>
                <p className="font-mono text-sm text-gray-600">{order.id}</p>
              </div>
            </div>
          )}

          {/* 待支付订单显示取消按钮和提示 */}
          {order.status === 'pending' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
              <p className="text-sm text-orange-800">
                <span className="font-medium">⏳ 温馨提示：</span>
                您的订单尚未支付，座位已被锁定。请尽快完成支付，超时后订单将自动取消并释放座位。
              </p>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">⚠️ 温馨提示：</span>
              请在开场前15分钟携带购票二维码或订单号到影院自助取票机或人工柜台取票。
            </p>
          </div>

          <div className="flex gap-4 mt-6">
            {/* 待支付订单可取消 */}
            {order.status === 'pending' && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-6 py-3.5 bg-gray-100 text-red-500 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                {cancelling ? '取消中...' : '取消订单'}
              </button>
            )}
            <Link
              to="/profile"
              className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-center rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
            >
              查看全部订单
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
