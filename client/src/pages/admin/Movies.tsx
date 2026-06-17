import { useState, useEffect } from 'react';
import { movieAPI, Movie } from '../../services/api';

export default function AdminMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Partial<Movie> | null>(null);
  const [formData, setFormData] = useState<Partial<Movie>>({
    title: '',
    poster: '',
    description: '',
    duration: 120,
    rating: 0,
    release_date: '',
    genre: '',
    director: '',
    cast: '',
    status: 'showing',
  });

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      const res = await movieAPI.getMovies();
      setMovies(res.data);
    } catch (error) {
      console.error('获取电影列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (movie?: Movie) => {
    if (movie) {
      setEditingMovie(movie);
      setFormData(movie);
    } else {
      setEditingMovie(null);
      setFormData({
        title: '',
        poster: '',
        description: '',
        duration: 120,
        rating: 0,
        release_date: '',
        genre: '',
        director: '',
        cast: '',
        status: 'showing',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMovie?.id) {
        await movieAPI.updateMovie(editingMovie.id, formData);
      } else {
        await movieAPI.createMovie(formData);
      }
      setShowModal(false);
      fetchMovies();
    } catch (error: any) {
      alert(error.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这部电影吗？')) return;
    try {
      await movieAPI.deleteMovie(id);
      fetchMovies();
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
        <h1 className="text-2xl font-bold text-gray-800">🎬 电影管理</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          + 添加电影
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">海报</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">电影名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">类型</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">时长</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">评分</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movies.map(movie => (
              <tr key={movie.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <img src={movie.poster} alt={movie.title} className="w-12 h-18 object-cover rounded" />
                </td>
                <td className="px-4 py-3 font-medium">{movie.title}</td>
                <td className="px-4 py-3 text-gray-600">{movie.genre}</td>
                <td className="px-4 py-3 text-gray-600">{movie.duration}分钟</td>
                <td className="px-4 py-3 text-yellow-500 font-medium">⭐ {movie.rating}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    movie.status === 'showing'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {movie.status === 'showing' ? '正在热映' : '即将上映'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(movie)}
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(movie.id)}
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
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <h2 className="text-xl font-bold mb-4">
              {editingMovie ? '编辑电影' : '添加电影'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">电影名称 *</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                  <input
                    type="text"
                    value={formData.genre || ''}
                    onChange={e => setFormData({ ...formData, genre: e.target.value })}
                    placeholder="如：科幻/冒险/灾难"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">时长（分钟）</label>
                  <input
                    type="number"
                    value={formData.duration || 0}
                    onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">评分</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.rating || 0}
                    onChange={e => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">上映日期</label>
                  <input
                    type="date"
                    value={formData.release_date || ''}
                    onChange={e => setFormData({ ...formData, release_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    value={formData.status || 'showing'}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="showing">正在热映</option>
                    <option value="coming">即将上映</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">导演</label>
                  <input
                    type="text"
                    value={formData.director || ''}
                    onChange={e => setFormData({ ...formData, director: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">主演</label>
                  <input
                    type="text"
                    value={formData.cast || ''}
                    onChange={e => setFormData({ ...formData, cast: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">海报链接</label>
                <input
                  type="url"
                  value={formData.poster || ''}
                  onChange={e => setFormData({ ...formData, poster: e.target.value })}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
                <textarea
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="input-field"
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
