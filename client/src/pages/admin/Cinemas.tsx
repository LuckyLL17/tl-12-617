import { useState, useEffect } from 'react';
import { cinemaAPI, Cinema } from '../../services/api';

export default function AdminCinemas() {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCinema, setEditingCinema] = useState<Cinema | null>(null);
  const [formData, setFormData] = useState<Partial<Cinema>>({
    name: '',
    address: '',
    city: '北京',
    district: '',
    phone: '',
    image: '',
  });

  useEffect(() => {
    fetchCinemas();
  }, []);

  const fetchCinemas = async () => {
    try {
      const res = await cinemaAPI.getCinemas();
      setCinemas(res.data);
    } catch (error) {
      console.error('获取影院列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cinema?: Cinema) => {
    if (cinema) {
      setEditingCinema(cinema);
      setFormData(cinema);
    } else {
      setEditingCinema(null);
      setFormData({
        name: '',
        address: '',
        city: '北京',
        district: '',
        phone: '',
        image: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCinema?.id) {
        await cinemaAPI.updateCinema(editingCinema.id, formData);
      } else {
        await cinemaAPI.createCinema(formData);
      }
      setShowModal(false);
      fetchCinemas();
    } catch (error: any) {
      alert(error.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个影院吗？')) return;
    try {
      await cinemaAPI.deleteCinema(id);
      fetchCinemas();
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
        <h1 className="text-2xl font-bold text-gray-800">🏢 影院管理</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          + 添加影院
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">图片</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">影院名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">城市</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">区域</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">地址</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">电话</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cinemas.map(cinema => (
              <tr key={cinema.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <img src={cinema.image} alt={cinema.name} className="w-16 h-12 object-cover rounded" />
                </td>
                <td className="px-4 py-3 font-medium">{cinema.name}</td>
                <td className="px-4 py-3 text-gray-600">{cinema.city}</td>
                <td className="px-4 py-3 text-gray-600">{cinema.district}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{cinema.address}</td>
                <td className="px-4 py-3 text-gray-600">{cinema.phone}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(cinema)}
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(cinema.id)}
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
              {editingCinema ? '编辑影院' : '添加影院'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">影院名称 *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">城市</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">区域</label>
                  <input
                    type="text"
                    value={formData.district || ''}
                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">图片链接</label>
                <input
                  type="url"
                  value={formData.image || ''}
                  onChange={e => setFormData({ ...formData, image: e.target.value })}
                  className="input-field"
                  placeholder="https://..."
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
