import { useEffect, useState, useMemo } from "react";
import {
  FiAlertCircle,
  FiLoader,
  FiMonitor,
  FiMapPin,
  FiClock,
  FiGlobe,
  FiSmartphone,
  FiTablet,
  FiRefreshCw,
} from "react-icons/fi";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import moment from "moment";
import { api } from "../api/client";

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

function getRecency(lastSeen) {
  if (!lastSeen)
    return {
      label: "—",
      color: "text-slate-500",
      bg: "bg-slate-500/20",
      pulse: false,
    };
  const m = moment(lastSeen);
  const mins = moment().diff(m, "minutes");
  const hours = moment().diff(m, "hours");
  const days = moment().diff(m, "days");
  const fromNow = moment(m.add(6, "hours")).fromNow();
  if (mins < 1)
    return {
      label: "Just now",
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
      pulse: true,
    };
  if (mins <= 30)
    return {
      label: fromNow,
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
      pulse: true,
    };
  if (hours < 2)
    return {
      label: fromNow,
      color: "text-emerald-300",
      bg: "bg-emerald-500/15",
      pulse: false,
    };
  if (hours < 24)
    return {
      label: fromNow,
      color: "text-amber-400",
      bg: "bg-amber-500/20",
      pulse: false,
    };
  if (days < 2)
    return {
      label: fromNow,
      color: "text-slate-400",
      bg: "bg-slate-500/20",
      pulse: false,
    };
  return {
    label: fromNow,
    color: "text-slate-500",
    bg: "bg-slate-500/15",
    pulse: false,
  };
}

function DeviceIcon({ deviceType }) {
  const d = (deviceType || "").toLowerCase();
  if (d.includes("mobile") || d.includes("phone"))
    return <FiSmartphone className="h-5 w-5 text-slate-400" />;
  if (d.includes("tablet"))
    return <FiTablet className="h-5 w-5 text-slate-400" />;
  return <FiMonitor className="h-5 w-5 text-slate-400" />;
}

const TABS = [
  { id: "device", label: "By device", icon: FiMonitor },
  { id: "location", label: "By location", icon: FiMapPin },
  { id: "recent", label: "Recent users", icon: FiClock },
];

export default function Users({ urlFilter, userId }) {
  const [tab, setTab] = useState("device");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [byDevice, setByDevice] = useState([]);
  const [byLocation, setByLocation] = useState([]);
  const [recent, setRecent] = useState([]);
  const [locationCountryFilter, setLocationCountryFilter] = useState(null);
  // New: explicit loading just for "recent"
  const [recentLoading, setRecentLoading] = useState(false);

  const filterVal = urlFilter?.trim() || null;

  const byCountryData = useMemo(() => {
    const map = new Map();
    for (const row of byLocation) {
      const name = row.country || "Unknown";
      map.set(name, (map.get(name) || 0) + Number(row.count || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [byLocation]);

  const totalCountries = byCountryData.length;
  const totalUsersLocation = useMemo(
    () => byLocation.reduce((sum, row) => sum + Number(row.count || 0), 0),
    [byLocation],
  );

  const filteredLocationRows = useMemo(() => {
    if (!locationCountryFilter) return byLocation;
    return byLocation.filter(
      (row) => (row.country || "") === locationCountryFilter,
    );
  }, [byLocation, locationCountryFilter]);

  const byRegionDataFiltered = useMemo(() => {
    const map = new Map();
    for (const row of filteredLocationRows) {
      const region = row.region || "Unknown";
      const country = row.country || "";
      const name = country ? `${region} (${country})` : region;
      map.set(name, (map.get(name) || 0) + Number(row.count || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLocationRows]);

  const byRegionDataTop = useMemo(
    () => byRegionDataFiltered.slice(0, 12),
    [byRegionDataFiltered],
  );
  const totalUsersRegionFiltered = useMemo(
    () =>
      filteredLocationRows.reduce(
        (sum, row) => sum + Number(row.count || 0),
        0,
      ),
    [filteredLocationRows],
  );

  // function to fetch all user data (all tabs)
  const fetchAllUserData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getUsersByDevice(filterVal, userId),
      api.getUsersByLocation(filterVal, userId),
      api.getRecentUsers(50, filterVal, userId),
    ])
      .then(([dev, loc, rec]) => {
        setByDevice(dev?.data ?? []);
        setByLocation(loc?.data ?? []);
        setRecent(rec?.data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load users");
        setLoading(false);
      });
  };

  // for main mount or changes on dependencies
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getUsersByDevice(filterVal, userId),
      api.getUsersByLocation(filterVal, userId),
      api.getRecentUsers(50, filterVal, userId),
    ])
      .then(([dev, loc, rec]) => {
        if (cancelled) return;
        setByDevice(dev?.data ?? []);
        setByLocation(loc?.data ?? []);
        setRecent(rec?.data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load users");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterVal, userId]);

  // function to reload just recent visitors
  const handleReloadRecent = async () => {
    setRecentLoading(true);
    try {
      const rec = await api.getRecentUsers(50, filterVal, userId);
      setRecent(rec?.data ?? []);
    } catch (err) {
      setError(err.message || "Failed to load recent users");
    } finally {
      setRecentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiLoader className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
        <FiAlertCircle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Users</h1>
      {filterVal && (
        <p className="text-sm text-slate-400">
          Filtering by URL/domain:{" "}
          <span className="font-medium text-emerald-400">
            &quot;{filterVal}&quot;
          </span>
        </p>
      )}

      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === id
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "device" && (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-200">
              Users by device
            </h2>
            <div className="mx-auto h-80 max-w-md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byDevice.map((row, i) => ({
                      name: row.device_type || "Unknown",
                      value: Number(row.count),
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {byDevice.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                    }}
                    formatter={(value) => [
                      Number(value).toLocaleString(),
                      "Users",
                    ]}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3 font-medium text-slate-300">
                    Device type
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">
                    Users
                  </th>
                </tr>
              </thead>
              <tbody>
                {byDevice.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-800/80 hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 text-slate-200">
                      {row.device_type || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-100">
                      {Number(row.count).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-3 text-slate-200">Total</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-100">
                    {byDevice
                      .reduce((sum, row) => sum + Number(row.count || 0), 0)
                      .toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "location" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2">
                <FiGlobe className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-slate-300">Total countries</span>
                <span className="font-semibold text-white">
                  {totalCountries}
                </span>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2">
                <span className="text-sm text-slate-300">
                  Total users (location)
                </span>
                <span className="ml-2 font-semibold text-white">
                  {totalUsersLocation.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="location-country"
                className="text-sm text-slate-400"
              >
                Filter by country
              </label>
              <select
                id="location-country"
                value={locationCountryFilter ?? ""}
                onChange={(e) =>
                  setLocationCountryFilter(e.target.value || null)
                }
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="">All countries</option>
                {byCountryData.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.value.toLocaleString()} users)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h2 className="mb-3 text-lg font-semibold text-slate-200">
                By country
              </h2>
              <div className="mx-auto h-72 max-w-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCountryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={false}
                    >
                      {byCountryData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#e2e8f0",
                      }}
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString()} users (${totalUsersLocation > 0 ? ((value / totalUsersLocation) * 100).toFixed(1) : 0}%)`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5 rounded-lg bg-slate-800/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Country-wise total users
                </p>
                {byCountryData.map((c, i) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      {c.name}
                    </span>
                    <span className="font-medium text-slate-200">
                      {c.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h2 className="mb-3 text-lg font-semibold text-slate-200">
                By region
                {locationCountryFilter && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({locationCountryFilter})
                  </span>
                )}
              </h2>
              {byRegionDataFiltered.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-slate-500">
                  No region data
                  {locationCountryFilter ? " for this country" : ""}.
                </div>
              ) : byRegionDataFiltered.length <= 5 ? (
                <div className="mx-auto h-72 max-w-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byRegionDataFiltered}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={false}
                      >
                        {byRegionDataFiltered.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#e2e8f0",
                        }}
                        formatter={(value, name) => [
                          `${Number(value).toLocaleString()} users${totalUsersRegionFiltered > 0 ? ` (${((value / totalUsersRegionFiltered) * 100).toFixed(1)}%)` : ""}`,
                          name,
                        ]}
                      />
                      <Legend wrapperStyle={{ color: "#94a3b8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={byRegionDataTop}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        type="number"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(v) =>
                          v.length > 22 ? v.slice(0, 20) + "…" : v
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#e2e8f0",
                        }}
                        formatter={(value) => [
                          Number(value).toLocaleString(),
                          "Users",
                        ]}
                        labelFormatter={(label) => label}
                      />
                      <Bar
                        dataKey="value"
                        name="Users"
                        fill="#10b981"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  {byRegionDataFiltered.length > 12 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Top 12 regions. See list and table below for all.
                    </p>
                  )}
                </div>
              )}
              <div className="mt-3 space-y-1.5 rounded-lg bg-slate-800/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Region-wise total users{" "}
                  {locationCountryFilter &&
                    `(${totalUsersRegionFiltered.toLocaleString()} in filter)`}
                </p>
                {byRegionDataFiltered.slice(0, 10).map((r, i) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-slate-300" title={r.name}>
                      {r.name}
                    </span>
                    <span className="ml-2 shrink-0 font-medium text-slate-200">
                      {r.value.toLocaleString()}
                    </span>
                  </div>
                ))}
                {byRegionDataFiltered.length > 10 && (
                  <p className="text-xs text-slate-500">
                    + {byRegionDataFiltered.length - 10} more in table below
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3 font-medium text-slate-300">
                    Country
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-300">
                    Region
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-300">City</th>
                  <th className="px-4 py-3 font-medium text-slate-300">
                    District
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">
                    Users
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLocationRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-800/80 hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 text-slate-200">
                      {row.country || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.region || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.city || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.district || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-100">
                      {Number(row.count).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "recent" && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2">
              <FiClock className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-slate-300">Recent visitors</span>
              <span className="font-semibold text-white">{recent.length}</span>
            </div>
            {recent.length > 0 && recent[0]?.last_seen && (
              <div className="text-sm text-slate-400">
                Most recent:{" "}
                <span className="font-medium text-emerald-400">
                  {moment(
                    moment(recent[0].last_seen).add(6, "hours"),
                  ).fromNow()}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleReloadRecent}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
              disabled={recentLoading}
              aria-label="Reload recent users"
            >
              <FiRefreshCw
                className={`h-4 w-4 ${recentLoading ? "animate-spin" : ""}`}
              />
              Reload
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentLoading ? (
              <div className="col-span-full flex justify-center py-10">
                <FiLoader className="h-6 w-6 animate-spin text-emerald-400" />
                <span className="ml-2 text-slate-400">Reloading...</span>
              </div>
            ) : (
              recent.map((row, i) => {
                const recency = getRecency(row.last_seen);
                const location =
                  [row.country, row.city].filter(Boolean).join(", ") ||
                  "Unknown";
                return (
                  <div
                    key={i}
                    className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                          <DeviceIcon deviceType={row.device_type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate font-medium text-slate-200"
                            title={location}
                          >
                            {location}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {row.device_type || "Unknown device"} ·{" "}
                            {Number(row.visit_count || 0).toLocaleString()}{" "}
                            visit
                            {(row.visit_count || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${recency.bg} ${recency.color} ${recency.pulse ? "animate-pulse" : ""}`}
                        title={
                          row.last_seen
                            ? moment(row.last_seen).format("MMM D, YYYY HH:mm")
                            : ""
                        }
                      >
                        {recency.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-800/80 pt-3">
                      <span
                        className="font-mono text-xs text-slate-500"
                        title="IP"
                      >
                        {row.ip_address || "—"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {recent.length === 0 && !recentLoading && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 py-16 text-center text-slate-500">
              No recent visitors to show.
            </div>
          )}

          <details className="rounded-xl border border-slate-800 bg-slate-900/30">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-300">
              View as table
            </summary>
            <div className="overflow-hidden border-t border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80">
                    <th className="px-4 py-3 font-medium text-slate-300">IP</th>
                    <th className="px-4 py-3 font-medium text-slate-300">
                      Device
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-300">
                      Location
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-right">
                      Visits
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-right">
                      Last seen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-slate-400"
                      >
                        <span className="flex items-center justify-center">
                          <FiLoader className="h-5 w-5 animate-spin text-emerald-400" />
                          <span className="ml-2">Reloading...</span>
                        </span>
                      </td>
                    </tr>
                  ) : (
                    recent.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-800/80 hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {row.ip_address || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.device_type || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {[row.country, row.city].filter(Boolean).join(", ") ||
                            "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {row.visit_count ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {row.last_seen
                            ? moment(row.last_seen)
                                .add(6, "hours")
                                .format("MMM D, hh:mm A")
                            : "—"}
                          {row.last_seen && (
                            <span className="ml-1.5 text-slate-500">
                              (
                              {moment(
                                moment(row.last_seen).add(6, "hours"),
                              ).fromNow()}
                              )
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
