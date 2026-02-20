import { useState } from 'react'
import { FiLock, FiMail, FiLoader, FiAlertCircle } from 'react-icons/fi'
import { api } from '../api/client'

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await api.login(email.trim(), password)
      onSuccess(token, user)
    } catch (err) {
      setError(err.body?.error || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
            <FiLock className="h-5 w-5 text-emerald-400" />
          </div>
          <span className="text-lg font-semibold text-white">Event Dashboard</span>
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-slate-200">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-400">
              Email
            </label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-400">
              Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
