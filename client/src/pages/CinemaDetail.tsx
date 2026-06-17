import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cinemaAPI, Cinema } from '../services/api';
import { useCityStore } from '../store/cityStore';
import DatePicker from '../components/DatePicker';
import PageHeader from '../components/PageHeader';

interface MovieSchedule {
  movie_id: string;
  movie_title: string;
  poster: string;
  duration: number;
  rating: number;
  schedules: any[];
}

export default function CinemaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCity } = useCityStore();
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [movieSchedules, setMovieSchedules] = useState<MovieSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    setSelectedDate(dates[0]);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !selectedDate) return;
      setLoading(true);
      try {
        const [cinemaRes, schedulesRes] = await Promise.all([
          cinemaAPI.getCinema(id),
          cinemaAPI.getCinemaSchedules(id, { date: selectedDate })
        ]);
        const cinemaData = cinemaRes.data;
        if (cinemaData.city !== selectedCity) {
          navigate('/cinemas');
          return;
        }
        setCinema(cinemaData);
        setMovieSchedules(schedulesRes.data as MovieSchedule[]);
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, selectedDate, selectedCity, navigate]);

  if (loading && !cinema) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!cinema) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-6xl mb-4">😢</div>
        <p>影院不存在</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {cinema && (
        <PageHeader 
          title={cinema.name} 
          subtitle={`${cinema.city} · ${cinema.district}`}
        />
      )}
      
      <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-6">
        <div className="flex flex-col md:flex-row">
          <img
            src={cinema.image}
            alt={cinema.name}
            className="w-full md:w-72 h-48 md:h-auto object-cover"
          />
          <div className="p-6 flex-1">
            <h1 className="text-2xl font-bold mb-3">{cinema.name}</h1>
            <div className="space-y-2 text-gray-600">
              <p className="flex items-start">
                <span className="mr-2 text-red-500">📍</span>
                <span>{cinema.address}</span>
              </p>
              <p className="flex items-center">
                <span className="mr-2 text-red-500">📞</span>
                <span>{cinema.phone}</span>
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <span className="px-3 py-1 bg-red-50 text-red-500 rounded-full text-sm">
                可退票
              </span>
              <span className="px-3 py-1 bg-green-50 text-green-500 rounded-full text-sm">
                可改签
              </span>
              <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-full text-sm">
                免费停车
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="font-semibold mb-4">📅 选择日期</h3>
        <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
        </div>
      ) : movieSchedules.length > 0 ? (
        <div className="space-y-6">
          {movieSchedules.map(ms => (
            <div key={ms.movie_id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex gap-4 mb-4">
                <img
                  src={ms.poster}
                  alt={ms.movie_title}
                  className="w-16 h-24 object-cover rounded-lg"
                />
                <div>
                  <h4 className="font-semibold text-lg">{ms.movie_title}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    ⭐ {ms.rating} · {ms.duration}分钟
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {ms.schedules.map((schedule: any) => (
                  <button
                    key={schedule.id}
                    onClick={() => navigate(`/schedules/${schedule.id}/confirm`)}
                    className="border rounded-lg p-3 hover:border-red-500 hover:bg-red-50 transition-all text-left group"
                  >
                    <div className="text-lg font-semibold text-gray-800 group-hover:text-red-500">
                      {schedule.start_time.split(' ')[1]}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {schedule.end_time.split(' ')[1]} 散场
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{schedule.hall}</div>
                    <div className="text-red-500 font-semibold mt-2">
                      ¥{schedule.price}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500 bg-white rounded-xl">
          <div className="text-6xl mb-4">🎬</div>
          <p>当日暂无排片</p>
          <p className="text-sm mt-2">请选择其他日期</p>
        </div>
      )}
    </div>
  );
}
