import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import logo from '../../assets/liveinv-logo.png'
import './admin-auth.css'

type Access = { status: 'checking' | 'denied' | 'error' } | { status: 'allowed'; user: User }

export function AdminAuth({ children }: { children: (user: User, signOut: () => Promise<void>) => ReactNode }) {
  const [session, setSession] = useState<Session | null>()
  const [access, setAccess] = useState<Access>({ status: 'checking' })
  const [sessionError, setSessionError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)

  useEffect(() => {
    let active = true
    let authEventReceived = false
    // Keep this callback synchronous: auth requests here can deadlock the SDK.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true
      if (active) {
        setSessionError(false)
        setSession(current => current?.access_token === nextSession?.access_token && current !== undefined ? current : nextSession)
      }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return
      if (error) setSessionError(true)
      else setSession(data.session)
    }).catch(() => { if (active && !authEventReceived) setSessionError(true) })
    return () => { active = false; subscription.unsubscribe() }
  }, [retry])

  useEffect(() => {
    let active = true
    setAccess({ status: 'checking' })
    if (!session) return () => { active = false }
    async function checkAdmin() {
      try {
        // Validate the session with Auth before consulting the protected allowlist.
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user || user.id !== session!.user.id) {
          if (active) setAccess({ status: 'error' })
          return
        }
        const { data: admin, error: adminError } = await supabase.from('admin_users')
          .select('user_id').eq('user_id', user.id).maybeSingle()
        if (active) setAccess(adminError ? { status: 'error' } : admin ? { status: 'allowed', user } : { status: 'denied' })
      } catch {
        if (active) setAccess({ status: 'error' })
      }
    }
    void checkAdmin()
    return () => { active = false }
  }, [session, retry])

  const signOut = async () => {
    setSigningOut(true)
    setSignOutError(false)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      setSession(null)
    } catch {
      setSignOutError(true)
    } finally {
      setSigningOut(false)
    }
  }

  if (!isSupabaseConfigured) return <AuthFrame><h1>Sign-in unavailable</h1><p>Please contact your system administrator to finish setting up access.</p></AuthFrame>
  if (signingOut) return <AuthFrame><p role="status">Signing out…</p></AuthFrame>
  if (signOutError) return <AuthFrame><h1>Sign-out interrupted</h1><p role="alert">We couldn’t finish signing out. Check your connection and try again.</p><button className="admin-auth-primary" onClick={() => void signOut()}>Try signing out again</button></AuthFrame>
  if (sessionError) return <AuthFrame><h1>Connection interrupted</h1><p role="alert">We couldn’t check your session.</p><button className="admin-auth-primary" onClick={() => { setSessionError(false); setRetry(value => value + 1) }}>Try again</button></AuthFrame>
  if (session === undefined || (session && access.status === 'checking')) return <AuthFrame><p role="status">Checking your access…</p></AuthFrame>
  if (!session) return <AdminLogin />
  if (access.status === 'allowed' && access.user.id === session.user.id) return children(access.user, signOut)
  return <AuthFrame>
    <span className="admin-auth-eyebrow">ADMIN ACCESS</span>
    <h1>{access.status === 'denied' ? 'Admin access required' : 'Unable to verify access'}</h1>
    <p role="alert">{access.status === 'denied' ? 'This account is not approved to manage LiveINV. Contact your system administrator.' : 'We couldn’t confirm your admin access. Check your connection or contact your system administrator.'}</p>
    <button className="admin-auth-primary" onClick={() => setRetry(value => value + 1)}>Check access again</button>
    <button className="admin-auth-secondary" onClick={() => void signOut()}>Sign out</button>
  </AuthFrame>
}

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError(error.code === 'invalid_credentials' ? 'The email or password is incorrect.' : error.status === 429 ? 'Too many attempts. Please wait a moment and try again.' : 'Unable to sign in. Check your credentials and connection, then try again.')
      }
    } catch {
      setError('Unable to connect. Please check your connection and try again.')
    } finally {
      setPassword('')
      setSubmitting(false)
    }
  }

  return <AuthFrame>
    <span className="admin-auth-eyebrow">ADMIN PORTAL</span>
    <h1>Welcome back.</h1>
    <p>Sign in to manage your hospital’s inventory.</p>
    <form onSubmit={submit} className="admin-login-form">
      <label htmlFor="admin-email">Email address</label>
      <input id="admin-email" name="email" type="email" autoComplete="username" placeholder="Enter your admin email" value={email} onChange={event => setEmail(event.target.value)} required disabled={submitting} />
      <label htmlFor="admin-password">Password</label>
      <div className="admin-password-field">
        <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required disabled={submitting} />
        <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
      </div>
      {error && <p className="admin-auth-error" role="alert">{error}</p>}
      <button className="admin-auth-primary" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="admin-auth-help">Admin accounts are managed by your system administrator. Contact them if you need access or a password reset.</p>
  </AuthFrame>
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="admin-auth-page">
    <section className="admin-auth-card" aria-label="LiveINV admin login">
      <img className="admin-auth-logo" src={logo} alt="LiveINV" />
      {children}
      <footer>Hospital inventory management</footer>
    </section>
  </main>
}
