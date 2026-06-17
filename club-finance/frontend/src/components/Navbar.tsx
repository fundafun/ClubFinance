import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-lg font-semibold text-indigo-600">
        Club Finance
      </Link>
      {user && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">Hi, {user.name}</span>
          <Link to="/profile" className="text-gray-600 hover:text-indigo-600">
            Profile
          </Link>
          <button onClick={handleLogout} className="text-gray-600 hover:text-red-600">
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
