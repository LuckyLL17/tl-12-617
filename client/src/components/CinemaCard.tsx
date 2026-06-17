import { Link } from 'react-router-dom';
import { Cinema } from '../services/api';

interface CinemaCardProps {
  cinema: Cinema;
}

export default function CinemaCard({ cinema }: CinemaCardProps) {
  return (
    <Link
      to={`/cinemas/${cinema.id}`}
      className="block bg-white rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300"
    >
      <div className="flex gap-4">
        <img
          src={cinema.image}
          alt={cinema.name}
          className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 text-lg">{cinema.name}</h3>
          <p className="text-sm text-gray-500 mt-1 flex items-start">
            <span className="mr-1">📍</span>
            <span className="line-clamp-2">{cinema.address}</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="mr-1">📞</span>
            {cinema.phone}
          </p>
          <div className="flex items-center mt-2 gap-2">
            <span className="px-2 py-0.5 bg-red-50 text-red-500 rounded text-xs">
              {cinema.district}
            </span>
            <span className="text-sm text-green-500 font-medium">
              票价 ¥30起
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
