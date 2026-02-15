import { useState } from 'react'
import { useLogin } from '../hooks/queries'
import { useNavigate } from 'react-router'
import { useTheme } from '../hooks/useTheme'

export function LoginView() {
  useTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const login = useLogin()
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    login.mutate(
      { username, password },
      {
        onSuccess: () => navigate('/inbox'),
        onError: () => setError('Invalid username or password'),
      },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm dark:bg-neutral-800">
        <h1 className="mb-6 text-center text-xl font-bold text-neutral-900 dark:text-neutral-100">
          ThingsToDo
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
              required
            />
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {login.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
