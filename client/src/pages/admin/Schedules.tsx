import { useState, useEffect } from 'react';
import { scheduleAPI, Schedule, movieAPI, cinemaAPI, Movie, Cinema } from '../../services/api';

export default function AdminSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    movie_id: '',
    cinema_id: '',
    start_time: '',
    end_time: '',
    hall: '',
    price: 50,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [schedRes, movieRes, cinemaRes] = await Promise.all([
        scheduleAPI.getSchedules(),
        movieAPI.getMovies(),
        cinemaAPI.getCinemas(),
      ]);
      setSchedules(schedRes.data);
      setMovies(movieRes.data);
      setCinemas(cinemaRes.data);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (schedule?: Schedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        movie_id: schedule.movie_id,
        cinema_id: schedule.cinema_id,
        start_time: schedule.start_time,
        end_time: schedule.end_time || '',
        hall: schedule.hall,
        price: schedule.price,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        movie_id: movies[0]?.id || '',
        cinema_id: cinemas[0]?.id || '',
        start_time: '',
        end_time: '',
        hall: '',
        price: 50,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSchedule?.id) {
        await scheduleAPI.updateSchedule(editingSchedule.id, formData);
      } else {
        await scheduleAPI.createSchedule(formData);
      }
      setShowModal(false);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个排片吗？')) return;
    try {
      await scheduleAPI.deleteSchedule(id);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📅 排片管理</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          + 添加排片
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">电影</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">影院</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">影厅</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">开始时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">结束时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">价格</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.map(schedule => (
              <tr key={schedule.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{schedule.movie_title}</td>
                <td className="px-4 py-3 text-gray-600">{schedule.cinema_name}</td>
                <td className="px-4 py-3 text-gray-600">{schedule.hall}</td>
                <td className="px-4 py-3 text-gray-600">{schedule.start_time}</td>
                <td className="px-4 py-3 text-gray-600">{schedule.end_time}</td>
                <td className="px-4 py-3 text-red-500 font-medium">¥{schedule.price}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(schedule)}
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="text-red-500 hover:text-red-600 text-sm"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg animate-fade-in">
            <h2 className="text-xl font-bold mb-4">
              {editingSchedule ? '编辑排片' : '添加排片'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择电影 *</label>
                <select
                  value={formData.movie_id}
                  onChange={e => setFormData({ ...formData, movie_id: e.target.value })}
                  className="input-field"
                  required
                >
                  {movies.map(movie => (
                    <option key={movie.id} value={movie.id}>{movie.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择影院 *</label>
                <select
                  value={formData.cinema_id}
                  onChange={e => setFormData({ ...formData, cinema_id: e.target.value })}
                  className="input-field"
                  required
                >
                  {cinemas.map(cinema => (
                    <option key={cinema.id} value={cinema.id}>{cinema.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">影厅 *</label>
                <input
                  type="text"
                  value={formData.hall}
                  onChange={e => setFormData({ ...formData, hall: e.target.value })}
                  placeholder="如：1号激光厅"
                  className="input-field"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间 *</label>
                  <input
                    type="datetime-local"
                    value={formData.start_time.replace(' ', 'T').slice(0, 16)}
                    onChange={e => setFormData({ ...formData, start_time: e.target.value.replace('T', ' ') + ':00' })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input
                    type="datetime-local"
                    value={formData.end_time?.replace(' ', 'T').slice(0, 16) || ''}
                    onChange={e => setFormData({ ...formData, end_time: e.target.value.replace('T', ' ') + ':00' })}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">票价（元）*</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  className="input-field"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
