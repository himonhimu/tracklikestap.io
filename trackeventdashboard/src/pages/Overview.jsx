import { useEffect, useState } from 'react'
import { FiUsers, FiActivity, FiAlertCircle, FiLoader } from 'react-icons/fi'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { api } from '../api/client'

export default function Overview({ urlFilter, userId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalUsers, setTotalUsers] = useState(null)
  const [eventCounts, setEventCounts] = useState(null)

  const filterVal = urlFilter?.trim() || null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.getTotalUsers(filterVal, userId),
      api.getEventCounts(filterVal, userId),
    ])
      .then(([usersRes, countsRes]) => {
        if (cancelled) return
        setTotalUsers(usersRes?.count ?? 0)
        setEventCounts(countsRes)
        setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load overview')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [filterVal, userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiLoader className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
        <FiAlertCircle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  const totalEvents = eventCounts?.totalCount ?? 0
  const eventsByType = eventCounts?.data ?? []
  const chartData = eventsByType.map((row) => ({
    name: row.event_type || 'Unknown',
    count: Number(row.count),
    fullName: row.event_type || 'Unknown',
  }))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Overview</h1>
      {filterVal && (
        <p className="text-sm text-slate-400">
          Filtering by URL/domain: <span className="font-medium text-emerald-400">&quot;{filterVal}&quot;</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/20 p-2">
              <FiUsers className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total unique users</p>
              <p className="text-2xl font-bold text-white">{Number(totalUsers).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2">
              <FiActivity className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total events</p>
              <p className="text-2xl font-bold text-white">{Number(totalEvents).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-200">Events by type</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={{ stroke: '#475569' }}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={{ stroke: '#475569' }}
                  axisLine={{ stroke: '#475569' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value) => [Number(value).toLocaleString(), 'Count']}
                  labelFormatter={(label) => `Event: ${label}`}
                />
                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="count" name="Events" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-200">Events by type (table)</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-3 font-medium text-slate-300">Event type</th>
                <th className="px-4 py-3 font-medium text-slate-300 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {eventsByType.map((row) => (
                <tr key={row.event_type} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-200">{row.event_type || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-100">
                    {Number(row.count).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
