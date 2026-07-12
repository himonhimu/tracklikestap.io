import { useEffect, useState } from 'react'
import {
  FiAlertCircle,
  FiLoader,
  FiDollarSign,
  FiShoppingCart,
  FiCreditCard,
  FiEye,
  FiTrash2,
  FiShoppingBag,
  FiPackage,
  FiBox,
} from 'react-icons/fi'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import moment from 'moment'
import { api } from '../api/client'

const TABS = [
  { id: 'pageView', label: 'Page view', icon: FiEye, eventType: 'PageView' },
  { id: 'purchase', label: 'Purchase', icon: FiDollarSign, eventType: 'Purchase' },
  { id: 'addToCart', label: 'Add to cart', icon: FiShoppingCart, eventType: 'AddToCart' },
  { id: 'initiateCheckout', label: 'Initiate checkout', icon: FiCreditCard, eventType: 'InitiateCheckout' },
  { id: 'viewCart', label: 'View cart', icon: FiShoppingBag, eventType: 'ViewCart' },
  { id: 'viewContent', label: 'View content', icon: FiPackage, eventType: 'ViewContent' },
  { id: 'viewItem', label: 'View item', icon: FiBox, eventType: 'ViewItem' },
  { id: 'removeFromCart', label: 'Remove from cart', icon: FiTrash2, eventType: 'RemoveFromCart' },
]

const DATE_RANGE_PRESETS = [
  { id: 'last7', label: 'Last 7 days', days: 7 },
  { id: 'last30', label: 'Last 30 days', days: 30 },
  { id: 'custom', label: 'Custom' },
]

const REFERRAL_FILTERS = [
  'All',
  'Google',
  'Facebook',
  'YouTube',
  'TikTok',
  'Twitter/X',
  'Direct',
  'Other',
]

const GRANULARITY_OPTIONS = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
]

function parseProductData(productData) {
  if (!productData) return null
  try {
    return typeof productData === 'string' ? JSON.parse(productData) : productData
  } catch {
    return null
  }
}

// Modified for +6 hour addition and 12 hour format
function formatPeriod(period, granularity) {
  if (!period) return ''
  const m = moment(period).add(6, 'hours') // Add 6 hours
  // Use 12-hour format everywhere
  return granularity === 'hourly' ? m.format('MMM D, hh:mm A') : m.format('MMM D, YYYY')
}

export default function Events({ urlFilter, userId }) {
  const [tab, setTab] = useState(TABS[0].id)
  const [error, setError] = useState(null)
  const [recentEvents, setRecentEvents] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [dateRangePreset, setDateRangePreset] = useState('last7')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [chartGranularity, setChartGranularity] = useState('daily')
  const [byTimeData, setByTimeData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [archives, setArchives] = useState([])
  const [referralFilter, setReferralFilter] = useState('All')

  const filterVal = urlFilter?.trim() || null
  const isPurchaseTab = tab === 'purchase'
  const listLimit = isPurchaseTab ? 300 : 50

  // Move logic that synchronously sets state out of the effect 
  // These are all computations based on state and props
  const isCustomRange = dateRangePreset === 'custom'
  const customRangeValid = isCustomRange && customFrom && customTo && customFrom <= customTo
  const presetDays = !isCustomRange ? (DATE_RANGE_PRESETS.find((p) => p.id === dateRangePreset)?.days ?? 7) : null

  const listDateFrom =
    isCustomRange && customRangeValid
      ? customFrom
      : !isCustomRange && presetDays
        ? moment().subtract(presetDays - 1, 'days').format('YYYY-MM-DD')
        : undefined
  const listDateTo =
    isCustomRange && customRangeValid
      ? customTo
      : !isCustomRange && presetDays
        ? moment().format('YYYY-MM-DD')
        : undefined

  useEffect(() => {
    api.getArchives?.()
      .then((res) => setArchives(res?.data ?? []))
      .catch(() => setArchives([]))
  }, [])

  // Effect for loading recent events when tab / filter / date range changes
  useEffect(() => {
    const config = TABS.find((t) => t.id === tab)
    const eventType = config?.eventType
    if (!eventType) return
    if (isCustomRange && !customRangeValid) {
      setRecentEvents([])
      setListLoading(false)
      return
    }
    let cancelled = false

    setListLoading(true)
    setError(null)
    api
      .getEventsByType(
        eventType,
        listLimit,
        filterVal,
        userId,
        listDateFrom,
        listDateTo,
        isPurchaseTab ? referralFilter : 'All',
      )
      .then((res) => {
        if (!cancelled) {
          setRecentEvents(res?.data ?? [])
          setListLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load events')
          setRecentEvents([])
          setListLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [
    tab,
    filterVal,
    userId,
    listDateFrom,
    listDateTo,
    isCustomRange,
    customRangeValid,
    listLimit,
    isPurchaseTab,
    referralFilter,
  ])

  const currentTabConfig = TABS.find((t) => t.id === tab) || TABS[0]

  // Effect for loading chart data
  useEffect(() => {
    const config = TABS.find((t) => t.id === tab)
    const eventType = config?.eventType
    if (!eventType) return

    // Avoid synchronous setState: Instead, derive empty state directly or let state follow data fetch
    // If the range is invalid, skip fetching and clear data
    if (isCustomRange && !customRangeValid) {
      setByTimeData([])
      setChartLoading(false)
      return
    }
    let cancelled = false

    setChartLoading(true)
    const days = isCustomRange ? undefined : presetDays
    const dateFrom = isCustomRange && customRangeValid ? customFrom : undefined
    const dateTo = isCustomRange && customRangeValid ? customTo : undefined
    api
      .getEventsByTime(eventType, chartGranularity, filterVal, days, dateFrom, dateTo, userId)
      .then((res) => {
        if (!cancelled) {
          setByTimeData(res?.data ?? [])
          setChartLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setByTimeData([])
          setChartLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [
    tab,
    chartGranularity,
    filterVal,
    dateRangePreset,
    presetDays,
    isCustomRange,
    customRangeValid,
    customFrom,
    customTo,
    userId,
  ])

  // No move needed for this mapping--derives from state
  const chartData = byTimeData.map((row) => ({
    period: row.period,
    label: formatPeriod(row.period, chartGranularity),
    count: Number(row.count),
  }))
  const eventLabel = currentTabConfig.label

  // Fix setState logic on custom date preset -- use a function passed to setDateRangePreset, so set states are not synchronous
  const handleDateRangePreset = (preset) => {
    setDateRangePreset((prev) => {
      if (preset.id === 'custom' && !customFrom && !customTo) {
        // Ensure date initialization is handled outside an effect, e.g. on button click, not in render/effect
        setCustomTo(moment().format('YYYY-MM-DD'))
        setCustomFrom(moment().subtract(6, 'days').format('YYYY-MM-DD'))
      }
      return preset.id
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Events</h1>
      {filterVal && (
        <p className="text-sm text-slate-400">
          Filtering by URL/domain: <span className="font-medium text-emerald-400">&quot;{filterVal}&quot;</span>
        </p>
      )}
      {archives.length > 0 && (
        <p className="text-xs text-slate-500">
          Archived months available:{' '}
          <span className="text-slate-400">
            {archives.map((a) => a.yearMonth).join(', ')}
          </span>
          {' '}— pick a custom date range in an archived month to load that data.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Chart for current event type */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-200">{eventLabel} over time</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setDateRangePreset(preset.id)
                    // This avoids synchronous setState in effects/render; it's in an event handler
                    if (preset.id === 'custom' && !customFrom && !customTo) {
                      setCustomTo(moment().format('YYYY-MM-DD'))
                      setCustomFrom(moment().subtract(6, 'days').format('YYYY-MM-DD'))
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${dateRangePreset === preset.id
                    ? 'bg-emerald-500/30 text-emerald-400'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {isCustomRange && (
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
            <div className="flex gap-2 border-l border-slate-700 pl-3">
              {GRANULARITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setChartGranularity(opt.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${chartGranularity === opt.id
                    ? 'bg-emerald-500/30 text-emerald-400'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {chartLoading ? (
          <div className="flex h-80 items-center justify-center">
            <FiLoader className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-80 flex-col items-center justify-center gap-1 text-slate-500">
            {isCustomRange && !customRangeValid ? (
              <>Select a valid date range (from ≤ to)</>
            ) : (
              <>No {eventLabel.toLowerCase()} data for this range</>
            )}
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={{ stroke: '#475569' }}
                  axisLine={{ stroke: '#475569' }}
                  interval="preserveStartEnd"
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
                  formatter={(value) => [Number(value).toLocaleString(), eventLabel]}
                  labelFormatter={(label, payload) => {
                    // label is already formatted, but let's force 12-hour format if hourly
                    // If chartGranularity is 'hourly', ensure label is always 12-hour
                    if (payload && payload.length > 0 && payload[0].payload && payload[0].payload.period) {
                      const m = moment(payload[0].payload.period).add(6, 'hours')
                      return chartGranularity === 'hourly'
                        ? m.format('MMM D, hh:mm A')
                        : m.format('MMM D, YYYY')
                    }
                    return label
                  }}
                />
                <Bar dataKey="count" name={eventLabel} fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
          <FiAlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-200">
          Recent {eventLabel}
          {isPurchaseTab ? (
            <span className="ml-2 text-sm font-normal text-slate-500">
              (up to {listLimit})
            </span>
          ) : null}
        </h2>
        {isPurchaseTab && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Referral
            <select
              value={referralFilter}
              onChange={(e) => setReferralFilter(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none"
            >
              {REFERRAL_FILTERS.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="px-4 py-3 font-medium text-slate-300">SL</th>
              <th className="px-4 py-3 font-medium text-slate-300">Time</th>
              <th className="px-4 py-3 font-medium text-slate-300">Path</th>
              <th className="px-4 py-3 font-medium text-slate-300">Device</th>
              <th className="px-4 py-3 font-medium text-slate-300">Value</th>
              <th className="px-4 py-3 font-medium text-slate-300">IP Address</th>
              {isPurchaseTab && (
                <th className="px-4 py-3 font-medium text-slate-300">Referral</th>
              )}
              <th className="px-4 py-3 font-medium text-slate-300">Product</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td
                  colSpan={isPurchaseTab ? 7 : 6}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <FiLoader className="mx-auto h-6 w-6 animate-spin" />
                </td>
              </tr>
            ) : recentEvents.length === 0 ? (
              <tr>
                <td
                  colSpan={isPurchaseTab ? 7 : 6}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  No events found
                </td>
              </tr>
            ) : (
              recentEvents.map((row, index) => {
                const product = parseProductData(row.product_data)
                const productLabel = Array.isArray(product)
                  ? product
                    .map((p) => `${p.name || p.id || 'Item'} - ${p.quantity || 1} pcs`)
                    .join(', ')
                  : product?.name || product?.id || '—'
                return (

                  <tr key={row.id} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.created_at
                        ? moment(row.created_at).add(6, 'hours').format('MMM D, hh:mm A')
                        : '—'}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-3 font-mono text-slate-300"
                      title={row.path}
                    >
                      {row.path || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.device_type || '—'}</td>
                    <td className="px-4 py-3 text-emerald-400">
                      {row.value != null
                        ? `${row.currency || ''} ${Number(row.value).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.ip_address || '—'}</td>
                    {isPurchaseTab && (
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          {row.referral_source || '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-300">{productLabel}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
