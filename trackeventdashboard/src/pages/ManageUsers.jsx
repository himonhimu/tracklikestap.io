import { useState, useEffect } from 'react'
import { FiEdit2, FiLoader, FiAlertCircle, FiX } from 'react-icons/fi'
import { api } from '../api/client'

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'super_admin', label: 'Super Admin' },
]

export default function ManageUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'user',
    pixel_id: '',
    access_token: '',
    test_code: '',
    site_url: '',
  })
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getUsers().then((res) => {
      if (!cancelled) {
        setUsers(res?.data ?? [])
        setLoading(false)
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Failed to load users')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  function openEdit(id) {
    setEditingId(id)
    setSaveError(null)
    setForm({ email: '', password: '', role: 'user', pixel_id: '', access_token: '', test_code: '', site_url: '' })
    api.getUser(id).then((res) => {
      const d = res?.data
      if (d) {
        setForm({
          email: d.email ?? '',
          password: '',
          role: d.role ?? 'user',
          pixel_id: d.pixel_id ?? '',
          access_token: d.access_token ?? '',
          test_code: d.test_code ?? '',
          site_url: d.site_url ?? '',
        })
      }
    }).catch(() => setSaveError('Failed to load user'))
  }

  function closeEdit() {
    setEditingId(null)
    setSaveError(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSaveError(null)
    setSaving(true)
    const payload = {
      email: form.email.trim() || undefined,
      role: form.role,
      pixel_id: form.pixel_id.trim() || undefined,
      access_token: form.access_token.trim() || undefined,
      test_code: form.test_code.trim() || undefined,
      site_url: form.site_url.trim() || undefined,
    }
    if (form.password.trim()) payload.password = form.password
    api.updateUser(editingId, payload).then(() => {
      setUsers((prev) =>
        prev.map((u) => (u.id_cr === editingId ? { ...u, email: payload.email ?? u.email, role: payload.role ?? u.role, site_url: payload.site_url ?? u.site_url } : u))
      )
      closeEdit()
      setSaving(false)
    }).catch((err) => {
      setSaveError(err.body?.error || err.message || 'Update failed')
      setSaving(false)
    })
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
      <h1 className="text-2xl font-bold text-white">Manage users</h1>
      <p className="text-sm text-slate-400">Edit user credentials and settings. Only super_admin can access this page.</p>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="px-4 py-3 font-medium text-slate-300">ID</th>
              <th className="px-4 py-3 font-medium text-slate-300">Email</th>
              <th className="px-4 py-3 font-medium text-slate-300">Role</th>
              <th className="px-4 py-3 font-medium text-slate-300">Site URL</th>
              <th className="px-4 py-3 font-medium text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id_cr} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                <td className="px-4 py-3 text-slate-400">{u.id_cr}</td>
                <td className="px-4 py-3 text-slate-200">{u.email || '—'}</td>
                <td className="px-4 py-3 text-slate-300">{u.role || 'user'}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-slate-400" title={u.site_url || ''}>{u.site_url || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(u.id_cr)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-2.5 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
                  >
                    <FiEdit2 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeEdit}>
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit user #{editingId}</h2>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {saveError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <FiAlertCircle className="h-4 w-4 shrink-0" />
                  {saveError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">New password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to keep current"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-500/50 focus:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">Site URL</label>
                <input
                  type="text"
                  value={form.site_url}
                  onChange={(e) => setForm((f) => ({ ...f, site_url: e.target.value }))}
                  placeholder="e.g. example.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">Pixel ID</label>
                <input
                  type="text"
                  value={form.pixel_id}
                  onChange={(e) => setForm((f) => ({ ...f, pixel_id: e.target.value }))}
                  placeholder="Facebook Pixel ID"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">Access token</label>
                <input
                  type="text"
                  value={form.access_token}
                  onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                  placeholder="API access token"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">Test code</label>
                <input
                  type="text"
                  value={form.test_code}
                  onChange={(e) => setForm((f) => ({ ...f, test_code: e.target.value }))}
                  placeholder="Test code"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
