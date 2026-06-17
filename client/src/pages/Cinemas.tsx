import { useState, useEffect } from 'react';
import { cinemaAPI, Cinema, City } from '../services/api';
import CinemaCard from '../components/CinemaCard';

export default function Cinemas() {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('北京');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    const fetchCities = async () => {
      const res = await cinemaAPI.getCities();
      setCities(res.data);
    };
    fetchCities();
  }, []);

  useEffect(() => {
    const fetchCinemas = async () => {
      setLoading(true);
      try {
        const params: { city?: string; district?: string } = { city: selectedCity };
        if (selectedDistrict) {
          params.district = selectedDistrict;
        }
        const res = await cinemaAPI.getCinemas(params);
        setCinemas(res.data);
      } catch (error) {
        console.error('获取影院列表失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCinemas();
  }, [selectedCity, selectedDistrict]);

  const currentCity = cities.find(c => c.city === selectedCity);

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="font-semibold mb-4">🏢 选择地区</h3>
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">城市：</p>
          <div className="flex flex-wrap gap-2">
            {cities.map(city => (
              <button
                key={city.city}
                onClick={() => {
                  setSelectedCity(city.city);
                  setSelectedDistrict(null);
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedCity === city.city
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {city.city}
              </button>
            ))}
          </div>
        </div>
        {currentCity && (
          <div>
            <p className="text-sm text-gray-500 mb-2">区县：</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedDistrict(null)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  !selectedDistrict
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {currentCity.districts.map(district => (
                <button
                  key={district}
                  onClick={() => setSelectedDistrict(district)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedDistrict === district
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {district}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {selectedCity} · {selectedDistrict || '全部'} 的影院
        </h2>
        <span className="text-sm text-gray-500">共 {cinemas.length} 家</span>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
        </div>
      ) : cinemas.length > 0 ? (
        <div className="grid gap-4">
          {cinemas.map(cinema => (
            <CinemaCard key={cinema.id} cinema={cinema} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500 bg-white rounded-xl">
          <div className="text-6xl mb-4">🏢</div>
          <p>当前地区暂无影院</p>
        </div>
      )}
    </div>
  );
}
