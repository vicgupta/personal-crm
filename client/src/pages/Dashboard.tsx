import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check } from 'lucide-react';
import { api } from '../api';
import { STAGE_LABELS, formatDate, formatMoney, monthLabel, type Activity, type DashboardData } from '../types';

function TaskList({
  title,
  tasks,
  emptyText,
  onToggle,
}: {
  title: string;
  tasks: Activity[];
  emptyText: string;
  onToggle: (a: Activity) => void;
}) {
  return (
    <div className="card">
      <h2>{title} ({tasks.length})</h2>
      {tasks.length === 0 && <div className="empty">{emptyText}</div>}
      {tasks.map((t) => (
        <div key={t.id} className={`task-row${t.done ? ' done' : ''}`}>
          <button
            className={`task-check${t.done ? ' done' : ''}`}
            aria-label={t.done ? 'Mark not done' : 'Mark done'}
            onClick={() => onToggle(t)}
          >
            {t.done && <Check />}
          </button>
          <span className="task-text">{t.description}</span>
          {t.due_date && (
            <span className={`task-due${!t.done && t.due_date < new Date().toISOString().slice(0, 10) ? ' overdue' : ''}`}>
              {formatDate(t.due_date)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.dashboard());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleTask = async (a: Activity) => {
    await api.activities.update(a.id, { done: !a.done });
    await load();
  };

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="loading">Loading dashboard…</div>;

  const openDeals = data.pipeline.filter((p) => p.stage !== 'won' && p.stage !== 'lost');
  const openCount = openDeals.reduce((n, p) => n + p.count, 0);
  const openValue = openDeals.reduce((n, p) => n + p.totalValue, 0);
  const expectedValue = data.pipeline.reduce((n, p) => n + p.expectedValue, 0);
  const wonRevenue = data.wonByMonth.reduce((n, w) => n + w.revenue, 0);

  const wonChart = data.wonByMonth.map((w) => ({ month: monthLabel(w.month), deals: w.deals, revenue: w.revenue }));
  const pipelineChart = data.pipeline.map((p) => ({
    stage: STAGE_LABELS[p.stage],
    total: Math.round(p.totalValue),
    expected: Math.round(p.expectedValue),
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>How your sales are going at a glance.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="label">Open deals</div><div className="value blue">{openCount}</div></div>
        <div className="stat"><div className="label">Open pipeline value</div><div className="value blue">{formatMoney(openValue)}</div></div>
        <div className="stat"><div className="label">Expected revenue</div><div className="value amber">{formatMoney(Math.round(expectedValue))}</div></div>
        <div className="stat"><div className="label">Revenue won</div><div className="value blue">{formatMoney(wonRevenue)}</div></div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <h2>Deals won per month</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={wonChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="deals" name="Deals won" fill="#209dd7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Revenue won per month</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={wonChart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: unknown) => formatMoney(Number(v ?? 0))} />
              <Bar dataKey="revenue" name="Revenue" fill="#1e9e5a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Pipeline by stage — total vs expected revenue</h2>
        <p style={{ color: 'var(--muted)', marginTop: -6, marginBottom: 12, fontSize: 13 }}>
          Expected revenue weights each deal by its probability of close.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={pipelineChart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" />
            <XAxis dataKey="stage" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v: unknown) => formatMoney(Number(v ?? 0))} />
            <Legend />
            <Bar dataKey="total" name="Total value" fill="#209dd7" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expected" name="Expected revenue" fill="#ecad0a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid">
        <TaskList title="Overdue tasks" tasks={data.overdueTasks} emptyText="Nothing overdue. Nice." onToggle={toggleTask} />
        <TaskList title="Upcoming tasks" tasks={data.upcomingTasks} emptyText="No upcoming tasks." onToggle={toggleTask} />
      </div>

      <div className="card">
        <h2>Recent activity</h2>
        {data.recentActivities.length === 0 && <div className="empty">No activity yet.</div>}
        {data.recentActivities.map((a) => (
          <div key={a.id} className="task-row">
            <span className={`badge badge-${a.type}`}>{a.type}</span>
            <span className="task-text">
              {a.description.length > 110 ? a.description.slice(0, 110) + '…' : a.description}
            </span>
            <span className="task-due">{formatDate(a.happened_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
