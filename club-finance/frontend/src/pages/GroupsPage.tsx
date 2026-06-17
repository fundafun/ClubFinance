import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api/client';

interface Group {
  id: string;
  name: string;
  role: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinGroupId, setJoinGroupId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadGroups = async () => {
    try {
      const res = await api.get('/groups');
      setGroups(res.data.groups);
    } catch {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await api.post('/groups', { name: newGroupName });
      setNewGroupName('');
      loadGroups();
    } catch {
      setError('Failed to create group');
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinGroupId.trim()) return;
    try {
      await api.post(`/groups/${joinGroupId.trim()}/join`);
      setJoinGroupId('');
      loadGroups();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join group');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto mt-8 px-4">
        <h1 className="text-2xl font-semibold mb-6">Your Groups</h1>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Create a new group</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Tufts Robotics"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700">
                Create
              </button>
            </div>
          </form>

          <form onSubmit={handleJoin} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Join an existing group</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Group ID"
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button className="bg-gray-800 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-900">
                Join
              </button>
            </div>
          </form>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : groups.length === 0 ? (
          <p className="text-gray-500 text-sm">You're not in any groups yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:border-indigo-200 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{g.name}</span>
                  <span className="text-xs uppercase tracking-wide text-gray-400">{g.role}</span>
                </div>
                <span className="text-xs text-gray-400">{g.id}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
