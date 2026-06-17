import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { scheduleAPI, Schedule } from '../services/api';
import PageHeader from '../components/PageHeader';

export default function OrderConfirm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(1);

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

  const totalPrice = ticketCount * schedule.price;

  const handleNext = () => {
    navigate(`/schedules/${id}/seats?tickets=${ticketCount}`);
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader 
        title="确认订单" 
        subtitle="请选择观影人数"
      />
      
      <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-6">

        <div className="p-6">
          <div className="flex gap-4 mb-6 pb-6 border-b">
            <img
              src={schedule.poster}
              alt={schedule.movie_title}
              className="w-24 h-36 object-cover rounded-lg"
            />
            <div className="flex-1">
              <h3 className="text-xl font-bold">{schedule.movie_title}</h3>
              <p className="text-gray-500 mt-2">
                📍 {schedule.cinema_name}
              </p>
              <p className="text-gray-500 mt-1">
                🕒 {schedule.start_time}
              </p>
              <p className="text-gray-500 mt-1">
                🎞️ {schedule.hall} · {schedule.duration}分钟
              </p>
              <p className="text-red-500 font-semibold mt-2">
                ¥{schedule.price} / 张
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold mb-4 flex items-center">
              <span className="mr-2">👥</span>
              选择观影人数
            </h4>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 text-2xl font-bold hover:bg-gray-200 transition-colors"
              >
                −
              </button>
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-800">{ticketCount}</span>
                <p className="text-sm text-gray-500 mt-1">张</p>
              </div>
              <button
                onClick={() => setTicketCount(Math.min(6, ticketCount + 1))}
                className="w-12 h-12 rounded-full bg-red-500 text-white text-2xl font-bold hover:bg-red-600 transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-center text-sm text-gray-400 mt-4">最多可购买6张票</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{ticketCount} 张票 × ¥{schedule.price}</span>
              <span className="text-2xl font-bold text-red-500">¥{totalPrice}</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleNext}
              className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/30"
            >
              下一步 · 选座
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
