import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { movieAPI, Movie, cinemaAPI, City } from '../services/api';
import { useCityStore } from '../store/cityStore';
import DatePicker from '../components/DatePicker';

interface ScheduleGroup {
  cinema_id: string;
  cinema_name: string;
  address: string;
  district: string;
  schedules: any[];
}

export default function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCity, selectedDistrict, setDistrict } = useCityStore();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [scheduleGroups, setScheduleGroups] = useState<ScheduleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [cities, setCities] = useState<City[]>([]);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    setSelectedDate(dates[0]);
    cinemaAPI.getCities().then(res => setCities(res.data));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !selectedDate) return;
      setLoading(true);
      try {
        const [movieRes, schedulesRes, cinemasRes] = await Promise.all([
          movieAPI.getMovie(id),
          movieAPI.getMovieSchedules(id, { date: selectedDate }),
          cinemaAPI.getCinemas()
        ]);
        setMovie(movieRes.data);
        
        let filtered = schedulesRes.data as ScheduleGroup[];
        filtered = filtered.filter(g => {
          const cinemaData = cinemasRes.data.find((c: any) => c.id === g.cinema_id);
          return cinemaData?.city === selectedCity;
        });
        if (selectedDistrict) {
          filtered = filtered.filter(g => g.district === selectedDistrict);
        }
        setScheduleGroups(filtered);
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, selectedDate, selectedCity, selectedDistrict]);

  const currentCity = cities.find(c => c.city === selectedCity);

  if (loading && !movie) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-6xl mb-4">😢</div>
        <p>电影不存在</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white -mx-4 -mt-6 px-4 py-8 mb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-48 h-72 object-cover rounded-xl shadow-2xl flex-shrink-0"
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{movie.title}</h1>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-yellow-400 text-xl font-bold">⭐ {movie.rating}</span>
              <span className="text-gray-300">{movie.genre}</span>
              <span className="text-gray-300">{movie.duration}分钟</span>
            </div>
            <p className="text-gray-300 mb-2">
              <span className="text-gray-400">导演：</span>{movie.director}
            </p>
            <p className="text-gray-300 mb-2">
              <span className="text-gray-400">主演：</span>{movie.cast}
            </p>
            <p className="text-gray-300 mb-4">
              <span className="text-gray-400">上映时间：</span>{movie.release_date}
            </p>
            <p className="text-gray-300 line-clamp-3">{movie.description}</p>
          </div>
        </div>
      </div>

      {movie.status === 'showing' && (
        <>
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">📅 选择日期</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">📍 {selectedCity}</span>
                {currentCity && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDistrict(null)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        !selectedDistrict
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      全部
                    </button>
                    {currentCity && currentCity.districts.map(district => (
                      <button
                        key={district}
                        onClick={() => setDistrict(district)}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          selectedDistrict === district
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {district}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
            </div>
          ) : scheduleGroups.length > 0 ? (
            <div className="space-y-4">
              {scheduleGroups.map(group => (
                <div key={group.cinema_id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-lg">{group.cinema_name}</h4>
                      <p className="text-sm text-gray-500 mt-1">📍 {group.address}</p>
                    </div>
                    <span className="text-sm text-red-500 font-medium">
                      最低价 ¥{Math.min(...group.schedules.map(s => s.price))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {group.schedules.map((schedule: any) => (
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
              <p>当前条件下暂无排片</p>
              <p className="text-sm mt-2">请尝试切换日期或地区</p>
            </div>
          )}
        </>
      )}

      {movie.status === 'coming' && (
        <div className="text-center py-20 text-gray-500 bg-white rounded-xl">
          <div className="text-6xl mb-4">⏰</div>
          <p className="text-xl font-medium">影片即将上映</p>
          <p className="mt-2">上映时间：{movie.release_date}</p>
          <p className="text-sm mt-4">敬请期待！</p>
        </div>
      )}
    </div>
  );
}
