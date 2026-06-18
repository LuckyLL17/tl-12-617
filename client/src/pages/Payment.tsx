import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule, orderAPI, Order } from '../services/api';
import PageHeader from '../components/PageHeader';

type PaymentMethod = 'alipay' | 'wechat' | 'card';
type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed' | 'expired';

export default function Payment() {
  const { id, orderId } = useParams<{ id: string; orderId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seatsParam = searchParams.get('seats');
  const autoCancelledRef = useRef(false); // 防止重复自动取消
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [countdown, setCountdown] = useState(900); // 15分钟倒计时
  const [seats, setSeats] = useState<string[]>([]);

  /**
   * 获取订单和排片信息
   * 支持两种模式：
   * 1. orderId 模式：从订单ID获取（新流程）
   * 2. scheduleId + seats 模式：从排片ID和座位获取（旧流程兼容）
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 模式1：通过订单ID获取
        if (orderId) {
          const orderRes = await orderAPI.getOrder(orderId);
          const orderData = orderRes.data;
          setOrder(orderData);
          setSeats(orderData.seats);
          
          // 获取排片信息
          const scheduleRes = await scheduleAPI.getSchedule(orderData.schedule_id);
          setSchedule(scheduleRes.data);
          
          // 计算剩余时间（15分钟锁定时间 - 已过时间）
          const createdAt = new Date(orderData.created_at).getTime();
          const now = Date.now();
          const lockDuration = 15 * 60 * 1000; // 15分钟
          const remaining = Math.max(0, Math.floor((lockDuration - (now - createdAt)) / 1000));
          setCountdown(remaining);
        }
        // 模式2：通过排片ID+座位（旧模式兼容）
        else if (id && seatsParam) {
          const decodedSeats = JSON.parse(decodeURIComponent(seatsParam));
          setSeats(decodedSeats);
          
          const scheduleRes = await scheduleAPI.getSchedule(id);
          setSchedule(scheduleRes.data);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, orderId, seatsParam]);

  /**
   * 倒计时逻辑
   * 倒计时结束后自动取消订单（如果有订单ID）
   */
  useEffect(() => {
    if (paymentStatus !== 'idle' && paymentStatus !== 'processing') return;
    if (countdown <= 0) {
      // 倒计时结束，自动取消订单
      if (orderId && !autoCancelledRef.current) {
        autoCancelledRef.current = true;
        handleAutoCancelOrder();
      }
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, paymentStatus, orderId]);

  /**
   * 自动取消订单（倒计时结束时调用）
   */
  const handleAutoCancelOrder = async () => {
    const targetOrderId = orderId || order?.id;
    if (!targetOrderId) return;
    
    try {
      await orderAPI.cancelOrder(targetOrderId);
      setPaymentStatus('expired');
    } catch (error: any) {
      console.error('自动取消订单失败:', error);
      setPaymentStatus('expired');
    }
  };

  /**
   * 格式化倒计时显示
   */
  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * 处理支付
   */
  const handlePayment = async () => {
    if (!id && !orderId) return;
    
    setPaymentStatus('processing');
    
    try {
      // 模拟支付等待
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let currentOrderId = orderId;
      
      // 旧模式：先创建订单再支付
      if (!orderId && id && seats.length > 0) {
        const createRes = await orderAPI.createOrder({
          schedule_id: id,
          seats: seats
        });
        currentOrderId = createRes.data.id;
      }
      
      if (currentOrderId) {
        // 调用支付接口
        await orderAPI.payOrder(currentOrderId);
        
        setPaymentStatus('success');
        
        // 支付成功后跳转到订单详情
        setTimeout(() => {
          navigate(`/orders/${currentOrderId}`);
        }, 2000);
      }
    } catch (error: any) {
      setPaymentStatus('failed');
      console.error('支付失败:', error);
    }
  };

  /**
   * 取消订单并释放座位
   */
  const handleCancelOrder = async () => {
    if (!orderId && !order) return;
    
    const targetOrderId = orderId || order?.id;
    if (!targetOrderId) return;
    
    if (!confirm('确定要取消订单吗？取消后座位将被释放。')) {
      return;
    }
    
    try {
      await orderAPI.cancelOrder(targetOrderId);
      alert('订单已取消，座位已释放');
      // 返回选座页面
      if (schedule) {
        navigate(`/schedules/${schedule.id}/seats?tickets=${seats.length}`);
      } else {
        navigate(-1);
      }
    } catch (error: any) {
      console.error('取消订单失败:', error);
      alert(error.response?.data?.message || '取消订单失败，请重试');
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

  const totalPrice = seats.length * schedule.price;

  const paymentMethods = [
    { id: 'alipay' as PaymentMethod, name: '支付宝', icon: '💙', color: 'border-blue-500 bg-blue-50' },
    { id: 'wechat' as PaymentMethod, name: '微信支付', icon: '💚', color: 'border-green-500 bg-green-50' },
    { id: 'card' as PaymentMethod, name: '银行卡', icon: '💳', color: 'border-orange-500 bg-orange-50' },
  ];

  return (
    <div className="animate-fade-in max-w-2xl mx-auto pb-20">
      {/* 待支付状态 */}
      {paymentStatus === 'idle' && (
        <>
          <PageHeader 
            title="确认支付" 
            subtitle="请选择支付方式并完成支付"
          />
          
          {/* 倒计时提示 */}
          {countdown > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏰</span>
                <div>
                  <p className="text-sm font-medium text-orange-800">座位已锁定，请尽快支付</p>
                  <p className="text-xs text-orange-600">超时未支付，订单将自动取消，座位将被释放</p>
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-orange-600">
                {formatCountdown()}
              </div>
            </div>
          )}
          
          {countdown <= 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-red-800">支付超时</p>
                  <p className="text-xs text-red-600">座位锁定已过期，请重新选择座位</p>
                </div>
              </div>
            </div>
          )}
          
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
                    座位：{[...seats].sort().join('、')} ({seats.length}张)
                  </p>
                  {order && (
                    <p className="text-sm text-gray-400 mt-1 font-mono">
                      订单号：{order.id}
                    </p>
                  )}
                </div>
              </div>

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
                {orderId && (
                  <button
                    onClick={handleCancelOrder}
                    className="px-6 py-3.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-medium"
                  >
                    取消订单
                  </button>
                )}
                <button
                  onClick={handlePayment}
                  disabled={countdown <= 0}
                  className={`flex-1 py-3.5 rounded-xl transition-all font-medium shadow-lg ${
                    countdown > 0
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-red-500/30'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {countdown > 0 ? `确认支付 ¥${totalPrice}` : '已超时，请重新下单'}
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
              <div className="text-4xl font-mono font-bold text-red-500 mb-2">
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
                    {order?.id || orderId || '处理中...'}
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
                  <span className="text-sm text-gray-600 font-mono">{order?.id || orderId}</span>
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
                {countdown > 0 && (
                  <button
                    onClick={() => setPaymentStatus('idle')}
                    className="px-8 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
                  >
                    重新支付
                  </button>
                )}
                <button
                  onClick={() => navigate(-1)}
                  className="px-8 py-3.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  返回选座
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 支付超时自动取消 */}
      {paymentStatus === 'expired' && (
        <>
          <PageHeader 
            title="支付超时" 
            subtitle="订单已自动取消，座位已释放"
          />
          
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">⏰</span>
              </div>
              <h2 className="text-2xl font-bold text-orange-600 mb-2">支付超时</h2>
              <p className="text-gray-500 mb-2">订单已自动取消</p>
              <p className="text-gray-400 text-sm mb-6">座位已释放，请重新选择座位</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    if (schedule) {
                      navigate(`/schedules/${schedule.id}/seats?tickets=${seats.length}`);
                    } else {
                      navigate(-1);
                    }
                  }}
                  className="px-8 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
                >
                  重新选座
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
