import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule, orderAPI } from '../services/api';
import PageHeader from '../components/PageHeader';

export default function SeatSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTicketCount = parseInt(searchParams.get('tickets') || '1', 10);
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [recommendedSeats, setRecommendedSeats] = useState<string[]>([]);
  const [ticketCount, setTicketCount] = useState(initialTicketCount);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);

  /** 获取排片信息 */
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

  /**
   * 智能推荐座位
   * 根据当前选择的人数推荐最佳座位
   */
  const handleRecommend = useCallback(async () => {
    if (!id || !schedule) return;
    
    setRecommending(true);
    setRecommendedSeats([]);
    
    try {
      const res = await orderAPI.recommendSeats(id, ticketCount);
      setRecommendedSeats(res.data.seats);
      // 自动选中推荐的座位
      setSelectedSeats(res.data.seats);
    } catch (error: any) {
      console.error('推荐座位失败:', error);
      alert(error.response?.data?.message || '推荐座位失败，请手动选择');
    } finally {
      setRecommending(false);
    }
  }, [id, schedule, ticketCount]);

  /**
   * 切换票数时，清除已选和推荐座位，并自动重新推荐
   */
  const handleTicketCountChange = (count: number) => {
    setTicketCount(count);
    setSelectedSeats([]);
    setRecommendedSeats([]);
  };

  /**
   * 切换座位选中状态
   */
  const toggleSeat = (seatId: string) => {
    if (!schedule?.seats[seatId]?.available || 
        schedule?.seats[seatId]?.sold || 
        schedule?.seats[seatId]?.locked) return;
    
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) {
        return prev.filter(s => s !== seatId);
      }
      if (prev.length >= ticketCount) {
        alert(`您已选择 ${ticketCount} 个座位，如需修改请先取消已选座位`);
        return prev;
      }
      return [...prev, seatId];
    });

    // 用户手动选择时，清除推荐高亮
    if (recommendedSeats.length > 0) {
      setRecommendedSeats([]);
    }
  };

  /**
   * 下一步：创建订单（锁座）并跳转到支付页
   */
  const handleNext = async () => {
    if (selectedSeats.length !== ticketCount) {
      alert(`请选择 ${ticketCount} 个座位`);
      return;
    }
    if (!id) return;
    
    try {
      // 创建订单（锁座）
      const res = await orderAPI.createOrder({ 
        schedule_id: id, 
        seats: selectedSeats 
      });
      
      // 跳转到支付页，带上订单ID
      navigate(`/payment/${res.data.id}`);
    } catch (error: any) {
      console.error('创建订单失败:', error);
      alert(error.response?.data?.message || '创建订单失败，请重试');
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
        const isLocked = seat?.locked;
        const isRecommended = recommendedSeats.includes(seatId);
        
        let seatClass = 'seat-available';
        let disabled = false;
        
        if (isSold) {
          seatClass = 'seat-sold';
          disabled = true;
        } else if (isLocked) {
          seatClass = 'seat-locked';
          disabled = true;
        } else if (isSelected) {
          seatClass = 'seat-selected';
        } else if (isRecommended) {
          seatClass = 'seat-recommended';
        }
        
        rowSeats.push(
          <button
            key={seatId}
            onClick={() => toggleSeat(seatId)}
            disabled={disabled}
            className={seatClass}
            title={isSold ? `${seatId} - 已售` : isLocked ? `${seatId} - 已锁定` : seatId}
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
  const remainingSeats = ticketCount - selectedSeats.length;
  // 可选票数范围1-6
  const ticketOptions = [1, 2, 3, 4, 5, 6];

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
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
            
            {/* 人数选择器 */}
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-2">选择人数：</p>
              <div className="flex gap-2">
                {ticketOptions.map(num => (
                  <button
                    key={num}
                    onClick={() => handleTicketCountChange(num)}
                    className={`w-10 h-10 rounded-full font-medium transition-all ${
                      ticketCount === num
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3">
              <span className={`text-sm ${remainingSeats > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                {remainingSeats > 0 ? `还需选择 ${remainingSeats} 个座位` : '已选满，可继续'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 座位图 */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        {/* 智能推荐按钮 */}
        <div className="flex justify-center mb-4">
          <button
            onClick={handleRecommend}
            disabled={recommending}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-medium shadow-md shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {recommending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                智能推荐中...
              </>
            ) : (
              <>
                ✨ 智能推荐 {ticketCount} 个最佳座位
              </>
            )}
          </button>
        </div>

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

        {/* 座位图例 */}
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
            <div className="w-5 h-5 rounded-t-lg bg-blue-400"></div>
            <span className="text-sm text-gray-600">推荐</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-orange-400"></div>
            <span className="text-sm text-gray-600">锁定</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-400"></div>
            <span className="text-sm text-gray-600">已售</span>
          </div>
        </div>
      </div>

      {/* 底部结算栏 */}
      <div className="bg-white rounded-xl p-4 shadow-sm sticky bottom-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">已选 {selectedSeats.length} / {ticketCount} 个座位</p>
            {selectedSeats.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                座位：{selectedSeats.sort().join('、')}
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
                disabled={selectedSeats.length !== ticketCount}
                className={`px-8 py-3.5 rounded-xl font-medium transition-all ${
                  selectedSeats.length === ticketCount
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
