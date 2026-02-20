import { FiBarChart2, FiFilter, FiLogOut, FiUser } from "react-icons/fi";

export default function Layout({
  nav,
  currentTab,
  onTabChange,
  urlFilter,
  onUrlFilterChange,
  user,
  onLogout,
  isSuperAdmin,
  users,
  usersLoading,
  selectedUser,
  onSelectUser,
  children,
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FiBarChart2 className="h-6 w-6 text-emerald-400" />
              <span className="font-semibold text-white">Next Dashboard</span>
            </div>
            <nav className="flex gap-1">
              {nav.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    currentTab === id
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
            {isSuperAdmin && (
              <div className="relative">
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <FiUser className="h-4 w-4" />
                  View as:
                </label>
                <select
                  value={selectedUser?.id_cr ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    const u = users.find((x) => x.id_cr === id) || null;
                    onSelectUser(u);
                  }}
                  disabled={usersLoading}
                  className="ml-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id_cr} value={u.id_cr}>
                      {u.email || u.site_url || `User #${u.id_cr}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isSuperAdmin && (
              <div className="flex flex-1 items-center gap-2 sm:max-w-xs">
                <FiFilter className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  type="text"
                  value={urlFilter}
                  onChange={(e) => onUrlFilterChange(e.target.value)}
                  placeholder="Filter by URL/domain"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
              <FiUser className="h-4 w-4 text-slate-500" />
              <span
                className="max-w-[180px] truncate text-sm text-slate-300"
                title={user?.email}
              >
                {user?.email}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                title="Log out"
              >
                <FiLogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
