import { useEffect, useState, useMemo } from 'react'
import { FiAlertCircle, FiLoader, FiShare2 } from 'react-icons/fi'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import moment from 'moment'
import { api } from '../api/client'

const DAY_PRESETS = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'all', label: 'All time', days: 0 },
  { id: 'custom', label: 'Custom', days: null },
]

const PIE_COLORS = [
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#94a3b8',
  '#f97316',
  '#38bdf8',
]

const STACK_KEYS = [
  { key: 'PageView', color: '#60a5fa', label: 'PageView' },
  { key: 'ViewItem', color: '#a78bfa', label: 'ViewItem' },
  { key: 'AddToCart', color: '#fbbf24', label: 'AddToCart' },
  { key: 'InitiateCheckout', color: '#fb7185', label: 'Checkout' },
  { key: 'Purchase', color: '#34d399', label: 'Purchase' },
]

const TABLE_COLS = [
  'PageView',
  'ViewItem',
  'AddToCart',
  'ViewCart',
  'InitiateCheckout',
  'Purchase',
]

export default function Referrals({ urlFilter, userId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState({ data: [], totalCount: 0 })
  const [daysPreset, setDaysPreset] = useState('30')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const filterVal = urlFilter?.trim() || null
  const isCustom = daysPreset === 'custom'
  const customValid = Boolean(isCustom && customFrom && customTo && customFrom <= customTo)
  const days = !isCustom
    ? (DAY_PRESETS.find((p) => p.id === daysPreset)?.days ?? 30)
    : null

  useEffect(() => {
    if (isCustom && !customValid) {
      setReport({ data: [], totalCount: 0 })
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const dateFrom = isCustom && customValid ? customFrom : undefined
    const dateTo = isCustom && customValid ? customTo : undefined

    api
      .getReferrals(filterVal, userId, days ?? 30, dateFrom, dateTo)
      .then((res) => {
        if (cancelled) return
        setReport({
          data: res?.data ?? [],
          totalCount: res?.totalCount ?? 0,
        })
        setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load referrals')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [filterVal, userId, days, isCustom, customValid, customFrom, customTo])

  const chartData = useMemo(
    () =>
      (report.data || []).map((row) => ({
        name: row.source,
        ...row,
        count: Number(row.total) || 0,
      })),
    [report.data],
  )

  const total = report.totalCount || 0

  const totalsByType = useMemo(() => {
    const t = {}
    for (const col of TABLE_COLS) t[col] = 0
    for (const row of report.data || []) {
      for (const col of TABLE_COLS) t[col] += Number(row[col]) || 0
    }
    return t
  }, [report.data])

  const selectPreset = (preset) => {
    setDaysPreset(preset.id)
    if (preset.id === 'custom' && !customFrom && !customTo) {
      setCustomTo(moment().format('YYYY-MM-DD'))
      setCustomFrom(moment().subtract(6, 'days').format('YYYY-MM-DD'))
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Referrals</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {DAY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  daysPreset === p.id
                    ? 'bg-emerald-500/30 text-emerald-400'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {isCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              />
              <span className="text-slate-500">–</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              />
            </div>
          )}
        </div>
      </div>

      {filterVal && (
        <p className="text-sm text-slate-400">
          Filtering by URL/domain:{' '}
          <span className="font-medium text-emerald-400">&quot;{filterVal}&quot;</span>
        </p>
      )}
      {userId && !filterVal && (
        <p className="text-sm text-slate-400">Filtered by selected user site</p>
      )}
      {isCustom && customValid && (
        <p className="text-sm text-slate-400">
          Date range:{' '}
          <span className="font-medium text-emerald-400">
            {customFrom} → {customTo}
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/20 p-2">
              <FiShare2 className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total events</p>
              <p className="text-2xl font-bold text-white">{Number(total).toLocaleString()}</p>
            </div>
          </div>
        </div>
        {['PageView', 'AddToCart', 'Purchase'].map((key) => (
          <div key={key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-sm text-slate-400">{key}</p>
            <p className="text-2xl font-bold text-white">
              {Number(totalsByType[key] || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {isCustom && !customValid ? (
        <p className="text-slate-400">Pick a valid from / to date.</p>
      ) : chartData.length === 0 ? (
        <p className="text-slate-400">No referral data for this range yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
            <h2 className="mb-4 text-lg font-semibold text-slate-200">
              By source (event breakdown)
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    height={60}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend />
                  {STACK_KEYS.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      stackId="a"
                      fill={s.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
            <h2 className="mb-4 text-lg font-semibold text-slate-200">Share of traffic</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Total</th>
                {TABLE_COLS.map((col) => (
                  <th key={col} className="px-4 py-3 font-medium">
                    {col}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/30">
              {chartData.map((row) => (
                <tr key={row.name} className="text-slate-200">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 font-semibold">
                    {Number(row.total || 0).toLocaleString()}
                  </td>
                  {TABLE_COLS.map((col) => (
                    <td key={col} className="px-4 py-3 text-slate-300">
                      {Number(row[col] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-slate-400">
                    {total > 0 ? ((Number(row.total) / total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
