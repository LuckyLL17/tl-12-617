import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { scheduleAPI, orderAPI, Schedule, Order } from '../services/api';
import PageHeader from '../components/PageHeader';

type PaymentMethod = 'alipay' | 'wechat' | 'card';
type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

/**
 * 支付页面
 * 支持两种模式：
 * 1. 订单支付模式（推荐）: /orders/:id/payment - 从待支付订单进入，先锁座再支付
 * 2. 直接支付模式: /schedules/:id/payment - 从选座页直接进入，创建并支付
 */
export default function Payment() {
  // 路由参数
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // 判断是订单支付模式还是直接支付模式
  const isOrderPayment = location.pathname.includes('/orders/');
  
  // 状态
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [countdown, setCountdown] = useState(900); // 15分钟倒计时
  const [orderId, setOrderId] = useState<string | null>(null);
  
  // 直接支付模式下的座位信息
  const seatsParam = searchParams.get('seats');
  const seats = seatsParam ? JSON.parse(decodeURIComponent(seatsParam)) : [];

  /**
   * 加载订单和排片信息
   */
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        if (isOrderPayment) {
          // 订单支付模式：获取订单详情
          const orderRes = await orderAPI.getOrder(id);
          const orderData = orderRes.data;
          setOrder(orderData);
          setOrderId(orderData.id);
          
          // 计算剩余支付时间
          if (orderData.locked_until) {
            const lockedUntil = new Date(orderData.locked_until).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((lockedUntil - now) / 1000));
            setCountdown(remaining);
          }
          
          // 获取排片信息
          const scheduleRes = await scheduleAPI.getSchedule(orderData.schedule_id);
          setSchedule(scheduleRes.data);
        } else {
          // 直接支付模式：获取排片信息
          const res = await scheduleAPI.getSchedule(id);
          setSchedule(res.data);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        alert('加载数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id, isOrderPayment]);

  /**
   * 支付倒计时
   */
  useEffect(() => {
    if (paymentStatus !== 'idle') return;
    if (!isOrderPayment && paymentStatus !== 'processing') {
      // 直接支付模式下，倒计时从支付开始时才启动
      return;
    }
    
    if (countdown <= 0) {
      return;
    }
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdown, paymentStatus, isOrderPayment]);

  /**
   * 格式化倒计时
   */
  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * 取消订单（仅订单支付模式）
   */
  const handleCancelOrder = async () => {
    if (!id || !isOrderPayment) return;
    
    if (!confirm('确定要取消订单吗？取消后座位将被释放。')) {
      return;
    }
    
    try {
      await orderAPI.cancelOrder(id);
      alert('订单已取消，座位已释放');
      navigate(-1);
    } catch (error: any) {
      console.error('取消订单失败:', error);
      alert(error.response?.data?.message || '取消订单失败，请稍后重试');
    }
  };

  /**
   * 处理支付
   */
  const handlePayment = async () => {
    if (!id) return;
    
    setPaymentStatus('processing');
    
    try {
      // 模拟支付处理延迟
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (isOrderPayment) {
        // 订单支付模式：调用订单支付接口
        const res = await orderAPI.payOrder(id);
        setOrderId(res.data.order.id);
      } else {
        // 直接支付模式：创建订单并支付（旧流程，保持向后兼容）
        const res = await orderAPI.createOrder({ schedule_id: id, seats });
        setOrderId(res.data.id);
      }
      
      // 模拟支付成功延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPaymentStatus('success');
      
      // 自动跳转到订单详情
      setTimeout(() => {
        if (orderId || id) {
          navigate(`/orders/${orderId || id}`);
        }
      }, 2000);
    } catch (error: any) {
      setPaymentStatus('failed');
      console.error('支付失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-6xl mb-4">😢</div>
        <p>排片不存在</p>
      </div>
    );
  }

  // 获取当前订单的座位列表
  const currentSeats = isOrderPayment ? order?.seats || [] : seats;
  const totalPrice = currentSeats.length * schedule.price;

  const paymentMethods = [
    { id: 'alipay' as PaymentMethod, name: '支付宝', icon: '💙', color: 'border-blue-500 bg-blue-50' },
    { id: 'wechat' as PaymentMethod, name: '微信支付', icon: '💚', color: 'border-green-500 bg-green-50' },
    { id: 'card' as PaymentMethod, name: '银行卡', icon: '💳', color: 'border-orange-500 bg-orange-50' },
  ];

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* 待支付状态 - 选择支付方式 */}
      {paymentStatus === 'idle' && (
        <>
          <PageHeader 
            title="确认支付" 
            subtitle="请选择支付方式并完成支付"
          />
          
          <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="p-6">
              {/* 订单信息 */}
              <div className="flex gap-4 mb-6 pb-6 border-b">
                <img
                  src={schedule.poster}
                  alt={schedule.movie_title}
                  className="w-20 h-28 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{schedule.movie_title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {schedule.cinema_name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {schedule.start_time} · {schedule.hall}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    座位：{currentSeats.sort().join('、')} ({currentSeats.length}张)
                  </p>
                </div>
              </div>

              {/* 倒计时（仅订单支付模式显示） */}
              {isOrderPayment && order && (
                <div className="mb-6 bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">支付剩余时间</p>
                  <div className={`text-3xl font-mono font-bold ${
                    countdown < 60 ? 'text-red-600 animate-pulse' : 'text-red-500'
                  }`}>
                    {formatCountdown()}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    超时后订单将自动取消，座位将被释放
                  </p>
                </div>
              )}

              {/* 支付方式选择 */}
              <div className="mb-6">
                <h4 className="font-semibold mb-4">选择支付方式</h4>
                <div className="space-y-3">
                  {paymentMethods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full flex items-center p-4 border-2 rounded-xl transition-all ${
                        paymentMethod === method.id
                          ? method.color
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl mr-3">{method.icon}</span>
                      <span className="font-medium flex-1 text-left">{method.name}</span>
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === method.id ? 'border-red-500' : 'border-gray-300'
                      }`}>
                        {paymentMethod === method.id && (
                          <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 金额 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">应付金额</span>
                  <span className="text-3xl font-bold text-red-500">¥{totalPrice}</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-4">
                {isOrderPayment && (
                  <button
                    onClick={handleCancelOrder}
                    className="px-6 py-3.5 border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-medium"
                  >
                    取消订单
                  </button>
                )}
                <button
                  onClick={handlePayment}
                  disabled={isOrderPayment && countdown <= 0}
                  className={`flex-1 py-3.5 rounded-xl font-medium transition-all shadow-lg ${
                    isOrderPayment && countdown <= 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-red-500/30'
                  }`}
                >
                  {isOrderPayment && countdown <= 0
                    ? '订单已超时'
                    : `确认支付 ¥${totalPrice}`
                  }
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 支付处理中 */}
      {paymentStatus === 'processing' && (
        <>
          <PageHeader 
            title="支付处理中" 
            subtitle="请在支付软件中完成支付"
          />
          
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="p-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-red-500"></div>
                <div className="absolute inset-0 flex items-center justify-center text-3xl">
                  {paymentMethod === 'alipay' ? '💙' : paymentMethod === 'wechat' ? '💚' : '💳'}
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">正在处理支付</h2>
              <p className="text-gray-500 mb-4">
                请在{paymentMethods.find(m => m.id === paymentMethod)?.name}中完成支付
              </p>
              <div className={`text-4xl font-mono font-bold mb-2 ${
                countdown < 60 ? 'text-red-600' : 'text-red-500'
              }`}>
                {formatCountdown()}
              </div>
              <p className="text-sm text-gray-400 mb-6">支付剩余时间</p>
              <div className="bg-gray-50 rounded-xl p-4 max-w-sm mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">支付金额</span>
                  <span className="text-xl font-bold text-red-500">¥{totalPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">订单编号</span>
                  <span className="text-sm text-gray-400 font-mono">
                    {orderId ? orderId : '等待生成...'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 支付成功 */}
      {paymentStatus === 'success' && (
        <>
          <PageHeader 
            title="支付成功" 
            subtitle="正在跳转至订单详情"
          />
          
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">支付成功！</h2>
              <p className="text-gray-500 mb-4">正在跳转至订单详情...</p>
              <div className="bg-green-50 rounded-xl p-4 max-w-sm mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500">支付金额</span>
                  <span className="text-xl font-bold text-red-500">¥{totalPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">订单编号</span>
                  <span className="text-sm text-gray-600 font-mono">{orderId}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 支付失败 */}
      {paymentStatus === 'failed' && (
        <>
          <PageHeader 
            title="支付失败" 
            subtitle={countdown <= 0 ? '支付超时，请重新下单' : '支付过程中出现问题'}
          />
          
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">❌</span>
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">支付失败</h2>
              <p className="text-gray-500 mb-6">
                {countdown <= 0 ? '支付超时，请重新下单' : '支付过程中出现问题，请重试'}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setPaymentStatus('idle')}
                  className="px-8 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
                >
                  重新支付
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="px-8 py-3.5 border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  返回
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
