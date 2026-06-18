import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule, Seat, orderAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import PageHeader from '../components/PageHeader';

// 可选人数列表
const TICKET_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function SeatSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketCount = parseInt(searchParams.get('tickets') || '1', 10);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [currentCount, setCurrentCount] = useState(ticketCount);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 获取排片信息（包含座位状态）
   */
  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    try {
      const res = await scheduleAPI.getSchedule(id);
      setSchedule(res.data);
    } catch (error) {
      console.error('获取排片信息失败:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 初次加载
  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // 定时刷新座位状态（每10秒刷新一次）
  useEffect(() => {
    if (!id) return;
    
    refreshTimerRef.current = setInterval(() => {
      fetchSchedule();
    }, 10000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [id, fetchSchedule]);

  // 更新URL中的票数参数
  const updateTicketCount = (count: number) => {
    setCurrentCount(count);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tickets', count.toString());
    setSearchParams(newParams);
    // 重新选择座位时清空已选
    setSelectedSeats([]);
  };

  /**
   * 检查座位是否可选（未售、未被其他人锁定）
   */
  const isSeatAvailable = (seatId: string): boolean => {
    if (!schedule) return false;
    const seat = schedule.seats[seatId];
    if (!seat || !seat.available || seat.sold) return false;
    if (seat.locked && seat.locked_until) {
      const now = new Date();
      const lockUntil = new Date(seat.locked_until);
      // 锁定未过期则不可选
      if (lockUntil > now) return false;
    }
    return true;
  };

  /**
   * 检查座位是否被锁定（非自己锁的）
   */
  const isSeatLocked = (seatId: string): boolean => {
    if (!schedule) return false;
    const seat = schedule.seats[seatId];
    if (!seat || !seat.locked) return false;
    if (seat.locked_until) {
      const now = new Date();
      const lockUntil = new Date(seat.locked_until);
      return lockUntil > now;
    }
    return false;
  };

  /**
   * 切换座位选择状态
   */
  const toggleSeat = (seatId: string) => {
    if (!isSeatAvailable(seatId)) return;
    
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) {
        return prev.filter(s => s !== seatId);
      }
      if (prev.length >= currentCount) {
        alert(`您已选择 ${currentCount} 个座位，如需修改请先取消已选座位`);
        return prev;
      }
      return [...prev, seatId];
    });
  };

  /**
   * 推荐座位 - 调用后端推荐接口
   */
  const handleRecommendSeats = async () => {
    if (!id) return;
    setRecommending(true);
    try {
      const res = await scheduleAPI.recommendSeats(id, currentCount);
      const recommended = res.data.recommended_seats;
      if (recommended && recommended.length > 0) {
        setSelectedSeats(recommended);
      } else {
        alert('暂无合适的座位推荐');
      }
    } catch (error: any) {
      console.error('推荐座位失败:', error);
      alert(error.response?.data?.message || '推荐座位失败，请重试');
    } finally {
      setRecommending(false);
    }
  };

  /**
   * 下一步 - 创建订单并锁定座位，跳转到支付页
   */
  const handleNext = async () => {
    if (!id) return;
    
    if (selectedSeats.length !== currentCount) {
      alert(`请选择 ${currentCount} 个座位`);
      return;
    }

    if (!isLoggedIn) {
      alert('请先登录');
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }

    try {
      // 创建订单（会自动锁定座位）
      const res = await orderAPI.createOrder({
        schedule_id: id,
        seats: selectedSeats
      });
      
      const orderId = res.data.id;
      // 跳转到支付页面
      navigate(`/payment/${orderId}`);
    } catch (error: any) {
      console.error('创建订单失败:', error);
      alert(error.response?.data?.message || '创建订单失败，请重试');
      // 刷新座位状态
      fetchSchedule();
    }
  };

  /**
   * 渲染座位矩阵
   */
  const renderSeats = () => {
    if (!schedule) return null;
    
    const rows = 8;
    const cols = 12;
    const seats = [];
    
    for (let r = 0; r < rows; r++) {
      const rowSeats = [];
      for (let c = 0; c < cols; c++) {
        const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
        const seat = schedule.seats[seatId];
        const isSelected = selectedSeats.includes(seatId);
        const isSold = seat?.sold;
        const isLocked = isSeatLocked(seatId);
        const available = isSeatAvailable(seatId);
        
        // 座位状态样式
        let seatClass = 'w-7 h-7 rounded-t-lg transition-all cursor-pointer ';
        if (isSold) {
          seatClass += 'bg-gray-400 cursor-not-allowed';
        } else if (isLocked) {
          seatClass += 'bg-orange-300 cursor-not-allowed';
        } else if (isSelected) {
          seatClass += 'bg-green-500 hover:bg-green-600';
        } else if (available) {
          seatClass += 'bg-gray-200 hover:bg-gray-300';
        } else {
          seatClass += 'bg-gray-300 cursor-not-allowed';
        }
        
        rowSeats.push(
          <button
            key={seatId}
            onClick={() => toggleSeat(seatId)}
            disabled={!available}
            className={seatClass}
            title={
              isSold ? `${seatId} - 已售` :
              isLocked ? `${seatId} - 已锁定` :
              isSelected ? `${seatId} - 已选` :
              `${seatId} - 可选`
            }
          />
        );
      }
      
      seats.push(
        <div key={r} className="flex items-center justify-center gap-1">
          <span className="w-6 text-center text-xs text-gray-400">{String.fromCharCode(65 + r)}</span>
          <div className="flex gap-1">{rowSeats}</div>
          <span className="w-6 text-center text-xs text-gray-400">{String.fromCharCode(65 + r)}</span>
        </div>
      );
    }
    
    return seats;
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

  const totalPrice = selectedSeats.length * schedule.price;
  const remainingSeats = currentCount - selectedSeats.length;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-20">
      <PageHeader 
        title="选择座位" 
        subtitle={schedule ? `${schedule.movie_title} · ${schedule.hall}` : '请选择座位'}
      />
      
      {/* 影片信息卡片 */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex gap-4">
          <img
            src={schedule.poster}
            alt={schedule.movie_title}
            className="w-24 h-36 object-cover rounded-lg"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold">{schedule.movie_title}</h2>
            <p className="text-gray-500 mt-2">
              📍 {schedule.cinema_name}
            </p>
            <p className="text-gray-500 mt-1">
              🕒 {schedule.start_time} · {schedule.hall}
            </p>
            <p className="text-gray-500 mt-1">
              ⏱️ {schedule.duration}分钟 · 屏幕方向：银幕中央
            </p>
          </div>
        </div>
      </div>

      {/* 人数选择 */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-700">选择票数</span>
          <span className="text-sm text-gray-500">点击人数可快速推荐座位</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {TICKET_OPTIONS.map(count => (
            <button
              key={count}
              onClick={() => updateTicketCount(count)}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                currentCount === count
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {count} 张
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleRecommendSeats}
            disabled={recommending}
            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <span>🎯</span>
            <span>{recommending ? '推荐中...' : '一键推荐最佳座位'}</span>
          </button>
        </div>
      </div>

      {/* 座位图 */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex justify-center mb-2">
          <div className="w-3/4 h-8 bg-gradient-to-b from-gray-300 to-gray-100 rounded-b-full flex items-center justify-center text-xs text-gray-500">
            银 幕
          </div>
        </div>
        
        <div className="flex justify-center my-6 text-sm">
          <div className="flex gap-1">{Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="w-7 text-center text-gray-400">{i + 1}</span>
          ))}</div>
        </div>

        <div className="space-y-2">{renderSeats()}</div>

        {/* 图例 */}
        <div className="flex justify-center gap-6 mt-8 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-200"></div>
            <span className="text-sm text-gray-600">可选</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-green-500"></div>
            <span className="text-sm text-gray-600">已选</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-orange-300"></div>
            <span className="text-sm text-gray-600">已锁定</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-400"></div>
            <span className="text-sm text-gray-600">已售</span>
          </div>
        </div>
      </div>

      {/* 选择状态提示 */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">已选 {selectedSeats.length} / {currentCount} 个座位</p>
            {remainingSeats > 0 ? (
              <p className="text-sm text-orange-500 mt-1">还需选择 {remainingSeats} 个座位</p>
            ) : (
              <p className="text-sm text-green-500 mt-1">已选满，可继续</p>
            )}
            {selectedSeats.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                座位：{[...selectedSeats].sort().join('、')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 底部结算栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">已选 {selectedSeats.length} / {currentCount} 个座位</p>
            {selectedSeats.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                座位：{[...selectedSeats].sort().join('、')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">合计</p>
                <p className="text-2xl font-bold text-red-500">¥{totalPrice}</p>
              </div>
              <button
                onClick={handleNext}
                disabled={selectedSeats.length !== currentCount}
                className={`px-8 py-3.5 rounded-xl font-medium transition-all ${
                  selectedSeats.length === currentCount
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                下一步 · 支付
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}
