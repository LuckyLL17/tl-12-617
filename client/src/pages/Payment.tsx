import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule, orderAPI } from '../services/api';
import PageHeader from '../components/PageHeader';

type PaymentMethod = 'alipay' | 'wechat' | 'card';
type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

export default function Payment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seatsParam = searchParams.get('seats');
  // 从URL参数解析已选座位
  const seats = seatsParam ? JSON.parse(decodeURIComponent(seatsParam)) : [];
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [countdown, setCountdown] = useState(900);
  // 创建订单后保存订单ID
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!id) return;
      try {
        const res = await scheduleAPI.getSchedule(id);
        setSchedule(res.data);
      } catch (error) {
        console.error('获取排片信息失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [id]);

  // 支付倒计时
  useEffect(() => {
    if (paymentStatus !== 'processing') return;
    if (countdown <= 0) {
      setPaymentStatus('failed');
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, paymentStatus]);

  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * 处理支付流程
   * 1. 创建订单（状态为 pending）
   * 2. 模拟支付过程
   * 3. 调用支付确认接口（pending → paid）
   */
  const handlePayment = async () => {
    if (!id || seats.length === 0) return;
    
    setPaymentStatus('processing');
    
    try {
      // 第一步：创建订单（状态为 pending，座位标记为已售出）
      const createRes = await orderAPI.createOrder({ schedule_id: id, seats });
      const newOrderId = createRes.data.id;
      setOrderId(newOrderId);

      // 模拟支付等待
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 第二步：确认支付（pending → paid）
      await orderAPI.payOrder(newOrderId);

      await new Promise(resolve => setTimeout(resolve, 1000));

      setPaymentStatus('success');

      // 支付成功后跳转到订单详情
      setTimeout(() => {
        navigate(`/orders/${newOrderId}`);
      }, 2000);
    } catch (error: any) {
      setPaymentStatus('failed');
      console.error('支付失败:', error);
    }
  };

  /**
   * 取消支付
   * 取消订单并释放座位，返回选座页面
   */
  const handleCancel = async () => {
    if (orderId) {
      try {
        await orderAPI.cancelOrder(orderId);
      } catch (error) {
        console.error('取消订单失败:', error);
      }
    }
    // 返回选座页面
    navigate(`/schedules/${id}/seats?tickets=${seats.length}`);
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
    <div className="animate-fade-in max-w-2xl mx-auto">
      {paymentStatus === 'idle' && (
        <>
          <PageHeader 
            title="确认支付" 
            subtitle="请选择支付方式并完成支付"
          />
          
          <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="p-6">
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
                    座位：{seats.sort().join('、')} ({seats.length}张)
                  </p>
                </div>
              </div>

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

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">应付金额</span>
                  <span className="text-3xl font-bold text-red-500">¥{totalPrice}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleCancel}
                  className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all font-medium"
                >
                  取消
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
                    {orderId || '等待生成...'}
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
                  <span className="text-sm text-gray-600 font-mono">{orderId}</span>
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
                {countdown <= 0 ? '支付超时，请重新下单' : '支付过程中出现问题，请重试'}
              </p>
              <div className="flex gap-4 justify-center">
                {/* 如果订单已创建，可以取消订单 */}
                {orderId && (
                  <button
                    onClick={async () => {
                      try {
                        await orderAPI.cancelOrder(orderId);
                      } catch (e) {}
                      navigate(`/schedules/${id}/seats?tickets=${seats.length}`);
                    }}
                    className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all font-medium"
                  >
                    取消并返回
                  </button>
                )}
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
