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

  // 取消订单
  const handleCancelOrder = async () => {
    if (!order?.id) return;
    if (!confirm('确定要取消订单吗？取消后座位将被释放。')) {
      return;
    }
    setCancelling(true);
    try {
      await orderAPI.cancelOrder(order.id);
      alert('订单已取消，座位已释放');
      // 刷新订单状态
      const res = await orderAPI.getOrder(order.id);
      setOrder(res.data);
    } catch (error: any) {
      console.error('取消订单失败:', error);
      alert(error.response?.data?.message || '取消订单失败，请重试');
    } finally {
      setCancelling(false);
    }
  };

  // 去支付
  const handleGoPay = () => {
    if (order?.id) {
      navigate(`/payment/${order.id}`);
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

  // 订单状态配置
  const statusText: { [key: string]: { text: string; color: string; icon: string; bgColor: string } } = {
    pending: { text: '待支付', color: 'text-orange-500', icon: '⏳', bgColor: 'from-orange-500 to-orange-600' },
    paid: { text: '已支付', color: 'text-green-500', icon: '✅', bgColor: 'from-green-500 to-green-600' },
    refunded: { text: '已退款', color: 'text-gray-500', icon: '↩️', bgColor: 'from-gray-500 to-gray-600' },
    cancelled: { text: '已取消', color: 'text-red-500', icon: '❌', bgColor: 'from-red-500 to-red-600' },
  };

  const status = statusText[order.status] || statusText.paid;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader 
        title="订单详情" 
        subtitle={order ? `${order.movie_title} · ${order.hall}` : '订单详情'}
      />
      
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        {/* 订单状态头部 */}
        <div className={`bg-gradient-to-r ${status.bgColor} text-white p-8 text-center`}>
          <div className="text-6xl mb-4">
            {order.status === 'paid' ? '🎉' : order.status === 'pending' ? '⏳' : order.status === 'cancelled' ? '😔' : '📋'}
          </div>
          <h2 className="text-2xl font-bold">
            {order.status === 'paid' ? '购票成功' : 
             order.status === 'pending' ? '等待支付' :
             order.status === 'cancelled' ? '订单已取消' : '订单详情'}
          </h2>
          <p className="mt-2 opacity-90">
            {order.status === 'paid' ? '请提前15分钟到影院取票' :
             order.status === 'pending' ? '请尽快完成支付，超时订单将自动取消' :
             order.status === 'cancelled' ? '座位已释放，欢迎下次再选购电影票' : '订单状态'}
          </p>
        </div>

        <div className="p-6">
          {/* 影片信息 */}
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

          {/* 订单详情 */}
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

          {/* 订单信息 */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500">订单号：{order.id}</p>
            <p className="text-sm text-gray-500 mt-1">下单时间：{order.created_at}</p>
          </div>

          {/* 已支付状态显示取票二维码 */}
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

          {/* 待支付状态显示操作按钮 */}
          {order.status === 'pending' && (
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-3.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                {cancelling ? '取消中...' : '取消订单'}
              </button>
              <button
                onClick={handleGoPay}
                className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
              >
                去支付
              </button>
            </div>
          )}

          {/* 温馨提示 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">⚠️ 温馨提示：</span>
              {order.status === 'paid' 
                ? '请在开场前15分钟携带购票二维码或订单号到影院自助取票机或人工柜台取票。'
                : order.status === 'pending'
                  ? '请在15分钟内完成支付，超时未支付订单将自动取消，座位将被释放。'
                  : '欢迎您下次再来选购电影票。'}
            </p>
          </div>

          {/* 返回按钮 */}
          <div className="flex gap-4 mt-6">
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
