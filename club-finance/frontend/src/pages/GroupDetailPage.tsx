import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string };
}

interface ExpenseShare {
  id: string;
  userId: string;
  amount: string;
  percentage?: string | null;
  user: { id: string; name: string };
}

interface Expense {
  id: string;
  description: string;
  amount: string;
  category?: string | null;
  notes?: string | null;
  splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE';
  paidBy: { id: string; name: string };
  shares: ExpenseShare[];
  createdAt: string;
}

interface Balance {
  user: { id: string; name: string; email: string };
  balance: number;
}

interface Suggestion {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

const CATEGORIES = ['Food', 'Travel', 'Equipment', 'Events', 'Other'];

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuthStore();

  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');

  // New expense form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [paidById, setPaidById] = useState('');
  const [splitType, setSplitType] = useState<'EQUAL' | 'CUSTOM' | 'PERCENTAGE'>('EQUAL');
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});

  const loadAll = async () => {
    try {
      const [groupRes, expensesRes, balancesRes, suggestionsRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/expenses`),
        api.get(`/groups/${groupId}/balances`),
        api.get(`/groups/${groupId}/settlements/suggested`),
      ]);

      setGroupName(groupRes.data.group.name);
      setMembers(groupRes.data.group.members);
      setExpenses(expensesRes.data.expenses);
      setBalances(balancesRes.data.balances);
      setSuggestions(suggestionsRes.data.suggestions);

      if (!paidById && user) setPaidById(user.id);
      if (participants.size === 0) {
        setParticipants(new Set(groupRes.data.group.members.map((m: Member) => m.userId)));
      }
    } catch {
      setError('Failed to load group data');
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const toggleParticipant = (userId: string) => {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('Food');
    setSplitType('EQUAL');
    setCustomAmounts({});
    setPercentages({});
  };

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const participantIds = Array.from(participants);
    if (participantIds.length === 0) {
      setError('Select at least one participant');
      return;
    }

    const payload: any = {
      description,
      amount: amountNum,
      category,
      paidById,
      splitType,
      participants: participantIds,
    };

    if (splitType === 'CUSTOM') {
      payload.customAmounts = {};
      for (const pid of participantIds) {
        payload.customAmounts[pid] = parseFloat(customAmounts[pid] || '0');
      }
    } else if (splitType === 'PERCENTAGE') {
      payload.percentages = {};
      for (const pid of participantIds) {
        payload.percentages[pid] = parseFloat(percentages[pid] || '0');
      }
    }

    try {
      await api.post(`/groups/${groupId}/expenses`, payload);
      resetForm();
      loadAll();
    } catch (err: any) {
      const apiErr = err.response?.data?.error;
      setError(typeof apiErr === 'string' ? apiErr : 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await api.delete(`/groups/${groupId}/expenses/${expenseId}`);
      loadAll();
    } catch {
      setError('Failed to delete expense');
    }
  };

  const handleRecordSettlement = async (toId: string, amount: number) => {
    try {
      await api.post(`/groups/${groupId}/settlements`, { toId, amount, status: 'PAID' });
      loadAll();
    } catch {
      setError('Failed to record settlement');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 mt-8 pb-12">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-semibold">{groupName || 'Group'}</h1>
        </div>
        <p className="text-xs text-gray-400 mb-6">Group ID: {groupId} (share to invite)</p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Add expense + expense list */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Expense</h2>
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Pizza Night"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="60.00"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Paid by</label>
                    <select
                      value={paidById}
                      onChange={(e) => setPaidById(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Split type</label>
                  <div className="flex gap-2">
                    {(['EQUAL', 'CUSTOM', 'PERCENTAGE'] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setSplitType(t)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                          splitType === t
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300'
                        }`}
                      >
                        {t === 'EQUAL' ? 'Equal' : t === 'CUSTOM' ? 'Custom $' : 'Percentage'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Split between</label>
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.userId} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={participants.has(m.userId)}
                          onChange={() => toggleParticipant(m.userId)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 w-28">{m.user.name}</span>
                        {splitType === 'CUSTOM' && participants.has(m.userId) && (
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={customAmounts[m.userId] || ''}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({ ...prev, [m.userId]: e.target.value }))
                            }
                            className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                        {splitType === 'PERCENTAGE' && participants.has(m.userId) && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0"
                              value={percentages[m.userId] || ''}
                              onChange={(e) =>
                                setPercentages((prev) => ({ ...prev, [m.userId]: e.target.value }))
                              }
                              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-medium hover:bg-indigo-700"
                >
                  Add Expense
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Expenses</h2>
              {expenses.length === 0 ? (
                <p className="text-sm text-gray-400">No expenses yet.</p>
              ) : (
                <div className="space-y-3">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800">{exp.description}</span>
                          {exp.category && (
                            <span className="ml-2 text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                              {exp.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-800">
                            ${Number(exp.amount).toFixed(2)}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Paid by {exp.paidBy.name} · {exp.splitType.toLowerCase()} split
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {exp.shares.map((s) => (
                          <span
                            key={s.id}
                            className="text-xs bg-gray-50 border border-gray-100 rounded px-2 py-0.5 text-gray-600"
                          >
                            {s.user.name}: ${Number(s.amount).toFixed(2)}
                            {s.percentage != null ? ` (${Number(s.percentage).toFixed(0)}%)` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: balances + settlements */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Balances</h2>
              <div className="space-y-2">
                {balances.map((b) => (
                  <div key={b.user.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{b.user.name}</span>
                    <span
                      className={
                        b.balance > 0
                          ? 'text-green-600 font-medium'
                          : b.balance < 0
                          ? 'text-red-500 font-medium'
                          : 'text-gray-400'
                      }
                    >
                      {b.balance > 0 ? '+' : ''}
                      {b.balance.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Suggested Settlements</h2>
              {suggestions.length === 0 ? (
                <p className="text-sm text-gray-400">Everyone is settled up.</p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {s.from.name} → {s.to.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">${s.amount.toFixed(2)}</span>
                        <button
                          onClick={() => handleRecordSettlement(s.to.id, s.amount)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Mark paid
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Members</h2>
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{m.user.name}</span>
                    <span className="text-xs uppercase text-gray-400">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
