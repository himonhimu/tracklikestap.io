import { useState, useEffect, useMemo } from 'react'
import { FiActivity, FiUsers, FiShoppingCart, FiSettings } from 'react-icons/fi'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Users from './pages/Users'
import Events from './pages/Events'
import ManageUsers from './pages/ManageUsers'
import { api } from './api/client'

const BASE_NAV = [
  { id: 'overview', label: 'Overview', icon: FiActivity },
  { id: 'users', label: 'Users', icon: FiUsers },
  { id: 'events', label: 'Events', icon: FiShoppingCart },
]

function Dashboard() {
  const { user, isSuperAdmin, logout } = useAuth()
  const [tab, setTab] = useState('overview')
  const [urlFilter, setUrlFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)

  const nav = useMemo(
    () =>
      isSuperAdmin
        ? [...BASE_NAV, { id: 'manageUsers', label: 'Manage users', icon: FiSettings }]
        : BASE_NAV,
    [isSuperAdmin]
  )

  const userId = isSuperAdmin && selectedUser ? selectedUser.id_cr : null

  useEffect(() => {
    if (!isSuperAdmin) return
    setUsersLoading(true)
    api.getUsers().then((res) => {
      setUsers(res?.data ?? [])
      setUsersLoading(false)
    }).catch(() => setUsersLoading(false))
  }, [isSuperAdmin])

  return (
    <Layout
      nav={nav}
      currentTab={tab}
      onTabChange={setTab}
      urlFilter={urlFilter}
      onUrlFilterChange={setUrlFilter}
      user={user}
      onLogout={logout}
      isSuperAdmin={isSuperAdmin}
      users={users}
      usersLoading={usersLoading}
      selectedUser={selectedUser}
      onSelectUser={setSelectedUser}
    >
      {tab === 'overview' && <Overview urlFilter={urlFilter} userId={userId} />}
      {tab === 'users' && <Users urlFilter={urlFilter} userId={userId} />}
      {tab === 'events' && <Events urlFilter={urlFilter} userId={userId} />}
      {tab === 'manageUsers' && <ManageUsers />}
    </Layout>
  )
}

function AppContent() {
  const { user, loading, login } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Login onSuccess={login} />
  }

  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
