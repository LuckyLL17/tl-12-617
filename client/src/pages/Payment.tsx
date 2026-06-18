import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule, orderAPI } from '../services/api';
import PageHeader from '../components/PageHeader';

type PaymentMethod = 'alipay' | 'wechat' | 'card';
type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

/**
 * 支付页面组件
 *
 * 支付流程说明：
 * 1. 用户从选座页面进入，携带已锁定的座位信息（座位仍处于锁定状态）
 * 2. 选择支付方式后点击「确认支付」
 * 3. 调用 POST /orders 创建订单（状态为 pending），座位标记为已售出，锁释放
 * 4. 模拟支付等待后，调用 PUT /orders/:id/pay 确认支付（pending → paid）
 * 5. 支付成功跳转订单详情页
 *
 * 锁座生命周期管理：
 * - 进入支付页时座位仍被锁定（SeatSelection不会在导航时解锁）
 * - 创建订单成功后，后端将座位标记为sold并释放锁
 * - 用户取消支付或支付失败时，需要主动解锁座位
 * - 支付成功后无需解锁（座位已售出）
 * - 组件卸载时（非支付成功），自动解锁座位防止死锁
 */
export default function Payment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 从URL参数解析已选座位（由选座页面传入）
  const seatsParam = searchParams.get('seats');
  const seats = seatsParam ? JSON.parse(decodeURIComponent(seatsParam)) : [];

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  // 当前选择的支付方式
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay');
  // 支付状态：idle-未开始, processing-处理中, success-成功, failed-失败
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  // 支付倒计时（15分钟，与后端订单超时时间一致）
  const [countdown, setCountdown] = useState(900);
  // 创建订单后保存订单ID，用于后续支付确认或取消
  const [orderId, setOrderId] = useState<string | null>(null);
  // 标记支付是否已成功完成，用于控制组件卸载时是否解锁座位
  // 支付成功后座位已标记为sold，不需要解锁
  const paymentSucceeded = useRef(false);

  // 获取排片信息
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

  // 组件卸载时释放锁座
  // 仅在支付未成功时解锁：如果支付成功，座位已标记为sold，无需解锁
  // 如果订单已创建（pending），取消订单会释放座位，此处也无需解锁
  // 此处主要处理：用户在支付页直接关闭浏览器或通过浏览器后退离开的场景
  useEffect(() => {
    return () => {
      if (id && !paymentSucceeded.current && !orderId) {
        scheduleAPI.unlockSeats(id).catch(() => {});
      }
    };
  }, [id, orderId]);

  // 支付倒计时：仅在支付处理中时计时
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

  // 格式化倒计时为 MM:SS
  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * 处理支付流程
   *
   * 两步式支付设计（防竞态）：
   * 第一步：创建订单（POST /orders）
   *   - 后端验证座位锁定状态，锁过期则拒绝创建
   *   - 订单状态为 pending，座位标记为 sold
   *   - 此时座位已被占用，不会被其他人选走
   *
   * 第二步：确认支付（PUT /orders/:id/pay）
   *   - 将订单状态从 pending 更新为 paid
   *   - 如果此步失败，订单仍为 pending，超时后自动取消并释放座位
   */
  const handlePayment = async () => {
    if (!id || seats.length === 0) return;

    setPaymentStatus('processing');

    try {
      // 第一步：创建订单（状态为 pending，座位标记为已售出，锁释放）
      const createRes = await orderAPI.createOrder({ schedule_id: id, seats });
      const newOrderId = createRes.data.id;
      setOrderId(newOrderId);

      // 模拟支付等待
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 第二步：确认支付（pending → paid）
      await orderAPI.payOrder(newOrderId);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 标记支付成功，防止组件卸载时解锁
      paymentSucceeded.current = true;
      setPaymentStatus('success');

      // 支付成功后跳转到订单详情
      setTimeout(() => {
        navigate(`/orders/${newOrderId}`);
      }, 2000);
    } catch (error: any) {
      setPaymentStatus('failed');
      // 如果错误码为 LOCK_EXPIRED，提示用户锁座已过期
      if (error.response?.data?.code === 'LOCK_EXPIRED') {
        alert('座位锁定已过期，请返回重新选座');
      }
    }
  };

  /**
   * 取消支付
   * - 如果订单已创建（pending），取消订单释放座位
   * - 如果订单未创建，解锁座位
   * 然后返回选座页面
   */
  const handleCancel = async () => {
    if (orderId) {
      // 订单已创建，取消订单（后端会释放sold座位）
      try {
        await orderAPI.cancelOrder(orderId);
      } catch (error) {
        console.error('取消订单失败:', error);
      }
    } else if (id) {
      // 订单未创建，座位仍处于锁定状态，需要手动解锁
      try {
        await scheduleAPI.unlockSeats(id);
      } catch (error) {
        console.error('解锁座位失败:', error);
      }
    }
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

  // 支付方式配置
  const paymentMethods = [
    { id: 'alipay' as PaymentMethod, name: '支付宝', icon: '💙', color: 'border-blue-500 bg-blue-50' },
    { id: 'wechat' as PaymentMethod, name: '微信支付', icon: '💚', color: 'border-green-500 bg-green-50' },
    { id: 'card' as PaymentMethod, name: '银行卡', icon: '💳', color: 'border-orange-500 bg-orange-50' },
  ];

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* 支付初始状态：选择支付方式 */}
      {paymentStatus === 'idle' && (
        <>
          <PageHeader
            title="确认支付"
            subtitle="请选择支付方式并完成支付"
          />

          <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="p-6">
              {/* 订单信息摘要 */}
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

              {/* 金额展示 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">应付金额</span>
                  <span className="text-3xl font-bold text-red-500">¥{totalPrice}</span>
                </div>
              </div>

              {/* 操作按钮 */}
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

      {/* 支付处理中状态 */}
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

      {/* 支付成功状态 */}
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

      {/* 支付失败状态 */}
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
                {/* 返回选座页：取消订单或解锁座位 */}
                <button
                  onClick={async () => {
                    if (orderId) {
                      // 订单已创建，取消订单释放座位
                      try {
                        await orderAPI.cancelOrder(orderId);
                      } catch (e) {}
                    } else if (id) {
                      // 订单未创建，解锁座位
                      try {
                        await scheduleAPI.unlockSeats(id);
                      } catch (e) {}
                    }
                    navigate(`/schedules/${id}/seats?tickets=${seats.length}`);
                  }}
                  className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all font-medium"
                >
                  取消并返回
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
