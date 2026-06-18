import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule, orderAPI, Order } from '../services/api';
import PageHeader from '../components/PageHeader';

type PaymentMethod = 'alipay' | 'wechat' | 'card';
type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

export default function Payment() {
  const { id, orderId } = useParams<{ id: string; orderId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // 旧模式参数（从排片页带过来的座位）
  const seatsParam = searchParams.get('seats');
  const seats = seatsParam ? JSON.parse(decodeURIComponent(seatsParam)) : [];
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [countdown, setCountdown] = useState(900);
  const hasUnmounted = useRef(false);
  
  // 使用 ref 跟踪最新状态，避免 useEffect 依赖变化导致的误取消
  const orderStatusRef = useRef<string | undefined>(undefined);
  const paymentStatusRef = useRef<PaymentStatus>('idle');

  /**
   * 获取订单信息和排片信息
   * 支持两种模式：
   * 1. orderId模式：从订单ID获取（新流程，已锁座）
   * 2. id + seats模式：从排片ID+座位参数获取（旧流程，兼容）
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (orderId) {
          // 新模式：根据订单ID获取
          const orderRes = await orderAPI.getOrder(orderId);
          setOrder(orderRes.data);
          orderStatusRef.current = orderRes.data.status;
          
          // 获取排片信息
          const scheduleRes = await scheduleAPI.getSchedule(orderRes.data.schedule_id);
          setSchedule(scheduleRes.data);
          
          // 计算剩余时间（秒）
          if (orderRes.data.expires_at) {
            const expireTime = new Date(orderRes.data.expires_at).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expireTime - now) / 1000));
            setCountdown(remaining);
          }
        } else if (id) {
          // 旧模式：根据排片ID获取
          const res = await scheduleAPI.getSchedule(id);
          setSchedule(res.data);
        }
      } catch (error) {
        console.error('获取信息失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, orderId]);

  // 同步状态到 ref
  useEffect(() => {
    orderStatusRef.current = order?.status;
  }, [order?.status]);
  
  useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

  /**
   * 取消订单并返回选座页
   */
  const handleCancelOrder = async () => {
    if (!orderId) return;
    
    try {
      await orderAPI.cancelOrder(orderId);
    } catch (error) {
      console.error('取消订单失败:', error);
    }
  };

  /**
   * 倒计时定时器
   * 待支付或处理中状态下运行倒计时
   */
  useEffect(() => {
    if (paymentStatus !== 'processing' && paymentStatus !== 'idle') return;
    if (countdown <= 0) {
      if (orderId && orderStatusRef.current === 'pending') {
        // 超时自动取消订单
        handleCancelOrder();
      }
      setPaymentStatus('failed');
      return;
    }
    
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdown, paymentStatus, orderId]);

  /**
   * 组件卸载时，如果订单还是pending状态且未开始支付，取消订单释放座位
   * 使用 ref 确保获取到最新状态，且不会因为依赖变化而误触发
   */
  useEffect(() => {
    hasUnmounted.current = false;
    
    return () => {
      hasUnmounted.current = true;
      // 只有在待支付且未开始支付时，离开页面才自动取消订单
      if (orderId && orderStatusRef.current === 'pending' && paymentStatusRef.current === 'idle') {
        orderAPI.cancelOrder(orderId).catch(err => {
          console.error('自动取消订单失败:', err);
        });
      }
    };
  }, [orderId]);

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
   * 新模式：调用payOrder接口
   * 旧模式：调用createOrder
   */
  const handlePayment = async () => {
    if (!id && !orderId) return;
    
    setPaymentStatus('processing');
    
    try {
      // 模拟支付处理时间
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (orderId) {
        // 新模式：已有订单，直接支付
        await orderAPI.payOrder(orderId);
      } else if (id && seats.length > 0) {
        // 旧模式：先创建订单再支付
        const orderRes = await orderAPI.createOrder({ 
          schedule_id: id, 
          seats 
        });
        
        // 短暂等待后调用支付
        await new Promise(resolve => setTimeout(resolve, 500));
        await orderAPI.payOrder(orderRes.data.id);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setPaymentStatus('success');
      
      // 2秒后跳转到订单详情
      setTimeout(() => {
        if (!hasUnmounted.current) {
          const targetOrderId = orderId || (id && seats.length > 0 ? '' : '');
          if (orderId) {
            navigate(`/orders/${orderId}`);
          } else {
            navigate('/profile?tab=orders');
          }
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

  // 使用订单中的座位或传入的座位
  const displaySeats = order?.seats || seats;
  const totalPrice = displaySeats.length * schedule.price;

  const paymentMethods = [
    { id: 'alipay' as PaymentMethod, name: '支付宝', icon: '💙', color: 'border-blue-500 bg-blue-50' },
    { id: 'wechat' as PaymentMethod, name: '微信支付', icon: '💚', color: 'border-green-500 bg-green-50' },
    { id: 'card' as PaymentMethod, name: '银行卡', icon: '💳', color: 'border-orange-500 bg-orange-50' },
  ];

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
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
                    座位：{[...displaySeats].sort().join('、')} ({displaySeats.length}张)
                  </p>
                </div>
              </div>

              {/* 锁座倒计时提示 */}
              {order?.status === 'pending' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⏰</span>
                      <div>
                        <p className="font-medium text-orange-800">座位已锁定</p>
                        <p className="text-sm text-orange-600">请在倒计时结束前完成支付，超时座位将自动释放</p>
                      </div>
                    </div>
                    <div className="text-3xl font-mono font-bold text-orange-500">
                      {formatCountdown()}
                    </div>
                  </div>
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

              <div className="flex gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="px-6 py-3.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  返回
                </button>
                <button
                  onClick={handlePayment}
                  className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
                >
                  确认支付 ¥{totalPrice}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
                    {orderId || '处理中...'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
                  <span className="text-sm text-gray-600 font-mono">{orderId || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
                {countdown <= 0 ? '支付超时，座位已释放，请重新下单' : '支付过程中出现问题，请重试'}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => navigate(-1)}
                  className="px-6 py-3.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  返回
                </button>
                <button
                  onClick={() => setPaymentStatus('idle')}
                  className="px-8 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
                >
                  重新支付
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
