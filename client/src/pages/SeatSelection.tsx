import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule } from '../services/api';
import PageHeader from '../components/PageHeader';

export default function SeatSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ticketCount = parseInt(searchParams.get('tickets') || '1', 10);
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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

  const toggleSeat = (seatId: string) => {
    if (!schedule?.seats[seatId]?.available || schedule?.seats[seatId]?.sold) return;
    
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
  };

  const handleNext = () => {
    if (selectedSeats.length !== ticketCount) {
      alert(`请选择 ${ticketCount} 个座位`);
      return;
    }
    if (!id) return;
    
    const seatsParam = encodeURIComponent(JSON.stringify(selectedSeats));
    navigate(`/schedules/${id}/payment?seats=${seatsParam}`);
  };

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
        
        let seatClass = 'seat-available';
        if (isSold) seatClass = 'seat-sold';
        else if (isSelected) seatClass = 'seat-selected';
        
        rowSeats.push(
          <button
            key={seatId}
            onClick={() => toggleSeat(seatId)}
            disabled={isSold}
            className={seatClass}
            title={seatId}
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

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <PageHeader 
        title="选择座位" 
        subtitle={schedule ? `${schedule.movie_title} · ${schedule.hall}` : '请选择座位'}
      />
      
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
            <div className="flex items-center gap-4 mt-2">
              <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-sm font-medium">
                👥 {ticketCount} 张票
              </span>
              <span className={`text-sm ${remainingSeats > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                {remainingSeats > 0 ? `还需选择 ${remainingSeats} 个座位` : '已选满，可继续'}
              </span>
            </div>
          </div>
        </div>
      </div>

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

        <div className="flex justify-center gap-8 mt-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-200"></div>
            <span className="text-sm text-gray-600">可选</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-green-500"></div>
            <span className="text-sm text-gray-600">已选</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-400"></div>
            <span className="text-sm text-gray-600">已售</span>
          </div>
        </div>
      </div>

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
