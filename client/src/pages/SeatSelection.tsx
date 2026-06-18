import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, orderAPI, Schedule } from '../services/api';
import PageHeader from '../components/PageHeader';

/**
 * 座位状态类型
 */
type SeatStatus = 'available' | 'selected' | 'sold' | 'locked' | 'recommended';

export default function SeatSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // 从URL参数获取票数，默认1张
  const initialTicketCount = parseInt(searchParams.get('tickets') || '1', 10);
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [recommendedSeats, setRecommendedSeats] = useState<string[]>([]);
  const [ticketCount, setTicketCount] = useState(initialTicketCount);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [holding, setHolding] = useState(false);

  /**
   * 获取排片信息
   */
  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await scheduleAPI.getSchedule(id);
      setSchedule(res.data);
    } catch (error) {
      console.error('获取排片信息失败:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  /**
   * 定时刷新座位状态，确保锁座状态实时更新
   * 每30秒刷新一次
   */
  useEffect(() => {
    const timer = setInterval(() => {
      if (id) {
        fetchSchedule();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [id, fetchSchedule]);

  /**
   * 获取座位状态
   * @param seatId 座位ID
   * @returns 座位状态
   */
  const getSeatStatus = (seatId: string): SeatStatus => {
    const seat = schedule?.seats[seatId];
    if (!seat || !seat.available) return 'sold';
    if (seat.sold) return 'sold';
    if (seat.locked) return 'locked';
    if (selectedSeats.includes(seatId)) return 'selected';
    if (recommendedSeats.includes(seatId)) return 'recommended';
    return 'available';
  };

  /**
   * 切换座位选择
   * @param seatId 座位ID
   */
  const toggleSeat = (seatId: string) => {
    const status = getSeatStatus(seatId);
    // 只有可选和已选状态可以点击
    if (status !== 'available' && status !== 'selected' && status !== 'recommended') return;

    setSelectedSeats(prev => {
      // 如果已选中，取消选中
      if (prev.includes(seatId)) {
        return prev.filter(s => s !== seatId);
      }
      // 如果已选满，提示用户
      if (prev.length >= ticketCount) {
        alert(`您已选择 ${ticketCount} 个座位，如需修改请先取消已选座位`);
        return prev;
      }
      // 添加选中
      return [...prev, seatId];
    });

    // 手动选择后清除推荐标记
    if (recommendedSeats.length > 0) {
      setRecommendedSeats([]);
    }
  };

  /**
   * 处理票数变更
   * @param count 新的票数
   */
  const handleTicketCountChange = (count: number) => {
    if (count < 1 || count > 6) return;
    setTicketCount(count);
    // 更新URL参数
    const params = new URLSearchParams(searchParams);
    params.set('tickets', count.toString());
    setSearchParams(params);
    // 变更票数后清空已选座位
    setSelectedSeats([]);
    setRecommendedSeats([]);
  };

  /**
   * 推荐座位
   * 调用后端API获取最佳座位推荐
   */
  const handleRecommend = async () => {
    if (!id) return;
    
    try {
      setRecommending(true);
      const res = await scheduleAPI.recommendSeats(id, ticketCount);
      const seats = res.data.seats;
      setRecommendedSeats(seats);
      setSelectedSeats(seats);
    } catch (error: any) {
      console.error('推荐座位失败:', error);
      alert(error.response?.data?.message || '推荐座位失败，请稍后重试');
    } finally {
      setRecommending(false);
    }
  };

  /**
   * 处理下一步（锁座并跳转支付）
   */
  const handleNext = async () => {
    if (selectedSeats.length !== ticketCount) {
      alert(`请选择 ${ticketCount} 个座位`);
      return;
    }
    if (!id) return;

    try {
      setHolding(true);
      // 调用锁座接口
      const res = await orderAPI.holdSeats({
        schedule_id: id,
        seats: selectedSeats
      });
      
      const orderId = res.data.order.id;
      // 跳转到支付页面
      navigate(`/orders/${orderId}/payment`);
    } catch (error: any) {
      console.error('锁座失败:', error);
      alert(error.response?.data?.message || '锁座失败，请稍后重试');
      // 失败后刷新座位状态
      fetchSchedule();
    } finally {
      setHolding(false);
    }
  };

  /**
   * 渲染座位图
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
        const status = getSeatStatus(seatId);
        const isClickable = status === 'available' || status === 'selected' || status === 'recommended';
        
        // 根据状态设置样式
        let seatClass = 'w-7 h-7 rounded-t-lg transition-all duration-200 ';
        let title = seatId;
        
        switch (status) {
          case 'available':
            seatClass += 'bg-gray-200 hover:bg-gray-300 cursor-pointer hover:scale-110';
            title += '（可选）';
            break;
          case 'selected':
            seatClass += 'bg-green-500 cursor-pointer hover:bg-green-600 scale-110 shadow-lg shadow-green-500/30';
            title += '（已选）';
            break;
          case 'sold':
            seatClass += 'bg-gray-400 cursor-not-allowed opacity-60';
            title += '（已售）';
            break;
          case 'locked':
            seatClass += 'bg-orange-300 cursor-not-allowed relative';
            title += '（锁定中）';
            break;
          case 'recommended':
            seatClass += 'bg-blue-400 cursor-pointer hover:bg-blue-500 animate-pulse shadow-lg shadow-blue-400/30';
            title += '（推荐）';
            break;
        }
        
        rowSeats.push(
          <button
            key={seatId}
            onClick={() => isClickable && toggleSeat(seatId)}
            disabled={!isClickable}
            className={seatClass}
            title={title}
          >
            {status === 'locked' && (
              <span className="absolute inset-0 flex items-center justify-center text-xs">🔒</span>
            )}
          </button>
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
  const remainingSeats = ticketCount - selectedSeats.length;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-28">
      <PageHeader 
        title="选择座位" 
        subtitle={schedule ? `${schedule.movie_title} · ${schedule.hall}` : '请选择座位'}
      />
      
      {/* 电影信息卡片 */}
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
              ⏱️ {schedule.duration}分钟 · 银幕中央
            </p>
            
            {/* 票数选择器 */}
            <div className="mt-3">
              <p className="text-sm text-gray-500 mb-2">选择票数（点击切换）</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    onClick={() => handleTicketCountChange(num)}
                    className={`w-10 h-10 rounded-full font-medium transition-all ${
                      ticketCount === num
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <span className="flex items-center ml-2 text-sm text-gray-500">
                  张票
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 座位图区域 */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        {/* 银幕 */}
        <div className="flex justify-center mb-2">
          <div className="w-3/4 h-8 bg-gradient-to-b from-gray-300 to-gray-100 rounded-b-full flex items-center justify-center text-xs text-gray-500">
            银 幕
          </div>
        </div>
        
        {/* 列号 */}
        <div className="flex justify-center my-6 text-sm">
          <div className="flex gap-1">{Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="w-7 text-center text-gray-400">{i + 1}</span>
          ))}</div>
        </div>

        {/* 座位 */}
        <div className="space-y-2">{renderSeats()}</div>

        {/* 图例说明 */}
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
            <div className="w-5 h-5 rounded-t-lg bg-blue-400 animate-pulse"></div>
            <span className="text-sm text-gray-600">推荐</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-orange-300 flex items-center justify-center text-xs">🔒</div>
            <span className="text-sm text-gray-600">锁定中</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-400 opacity-60"></div>
            <span className="text-sm text-gray-600">已售</span>
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              已选 {selectedSeats.length} / {ticketCount} 个座位
            </p>
            {selectedSeats.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                座位：{selectedSeats.sort().join('、')}
              </p>
            )}
            {remainingSeats > 0 && (
              <p className="text-sm text-orange-500 mt-1">
                还需选择 {remainingSeats} 个座位
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* 推荐座位按钮 */}
            <button
              onClick={handleRecommend}
              disabled={recommending}
              className="px-4 py-2.5 rounded-xl border-2 border-blue-500 text-blue-500 font-medium hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recommending ? '推荐中...' : '✨ 推荐座位'}
            </button>
            
            <div className="text-right">
              <p className="text-sm text-gray-500">合计</p>
              <p className="text-2xl font-bold text-red-500">¥{totalPrice}</p>
            </div>
            
            {/* 下一步按钮 */}
            <button
              onClick={handleNext}
              disabled={selectedSeats.length !== ticketCount || holding}
              className={`px-8 py-3.5 rounded-xl font-medium transition-all ${
                selectedSeats.length === ticketCount && !holding
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {holding ? '锁定座位中...' : '下一步 · 支付'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
