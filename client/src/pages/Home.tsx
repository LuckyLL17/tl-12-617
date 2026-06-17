import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { movieAPI, Movie } from '../services/api';
import MovieCard from '../components/MovieCard';

export default function Home() {
  const [showingMovies, setShowingMovies] = useState<Movie[]>([]);
  const [comingMovies, setComingMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const [showingRes, comingRes] = await Promise.all([
          movieAPI.getMovies({ status: 'showing', limit: 8 }),
          movieAPI.getMovies({ status: 'coming', limit: 6 })
        ]);
        setShowingMovies(showingRes.data);
        setComingMovies(comingRes.data);
      } catch (error) {
        console.error('获取电影列表失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, []);

  const banners = [
    { id: 1, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20banner%20movie%20promotion%20colorful%20wide&image_size=landscape_16_9', title: '流浪地球3 震撼上映' },
    { id: 2, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=movie%20festival%20banner%20discount%20promotion&image_size=landscape_16_9', title: '新用户首单立减10元' },
    { id: 3, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=imax%20cinema%20experience%20banner&image_size=landscape_16_9', title: 'IMAX激光厅 极致体验' },
  ];

  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative rounded-2xl overflow-hidden h-72 md:h-96">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentBanner ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 text-white">
              <h2 className="text-3xl font-bold mb-2">{banner.title}</h2>
              <p className="text-gray-200">精选好片，尽在淘票票</p>
            </div>
          </div>
        ))}
        <div className="absolute bottom-4 right-4 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentBanner ? 'bg-white w-6' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">🔥 正在热映</h2>
          <Link to="/movies" className="text-red-500 hover:text-red-600 flex items-center">
            查看全部 <span className="ml-1">→</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {showingMovies.map(movie => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">🎬 即将上映</h2>
          <Link to="/movies?status=coming" className="text-red-500 hover:text-red-600 flex items-center">
            查看全部 <span className="ml-1">→</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {comingMovies.map(movie => (
            <div key={movie.id} className="group cursor-pointer">
              <Link to={`/movies/${movie.id}`}>
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="text-white text-sm font-medium truncate">{movie.title}</p>
                    <p className="text-gray-300 text-xs">{movie.release_date}</p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
