import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { movieAPI, Movie } from '../services/api';
import MovieCard from '../components/MovieCard';

export default function Movies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || 'showing');

  const tabs = [
    { key: 'showing', label: '正在热映' },
    { key: 'coming', label: '即将上映' },
  ];

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const res = await movieAPI.getMovies({ status: activeTab });
        setMovies(res.data);
      } catch (error) {
        console.error('获取电影列表失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
    setSearchParams({ status: activeTab });
  }, [activeTab]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-6 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 px-2 font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-red-500 border-red-500'
                : 'text-gray-500 border-transparent hover:text-red-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto text-sm text-gray-500">
          共 {movies.length} 部电影
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
        </div>
      ) : movies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {movies.map(movie => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🎬</div>
          <p>暂无相关电影</p>
        </div>
      )}
    </div>
  );
}
