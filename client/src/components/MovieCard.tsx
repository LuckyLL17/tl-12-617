import { Link } from 'react-router-dom';
import { Movie } from '../services/api';

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link
      to={`/movies/${movie.id}`}
      className="block bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 movie-card-hover"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={movie.poster}
          alt={movie.title}
          className="w-full h-full object-cover"
        />
        {movie.rating > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 px-2 py-1 rounded-lg text-sm font-bold">
            ⭐ {movie.rating}
          </div>
        )}
        {movie.status === 'coming' && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-medium">
            即将上映
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-800 truncate">{movie.title}</h3>
        <p className="text-sm text-gray-500 mt-1">{movie.genre}</p>
        <p className="text-xs text-gray-400 mt-1">{movie.duration}分钟</p>
        {movie.status === 'showing' ? (
          <button className="w-full mt-3 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
            立即购票
          </button>
        ) : (
          <button className="w-full mt-3 bg-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium">
            期待上映
          </button>
        )}
      </div>
    </Link>
  );
}
