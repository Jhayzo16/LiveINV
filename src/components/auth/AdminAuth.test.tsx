import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), getUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(),
  maybeSingle: vi.fn(), unsubscribe: vi.fn(), listener: undefined as undefined | ((event: string, session: unknown) => void),
}))
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession, getUser: mocks.getUser, signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut,
      onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  },
}))
import { AdminAuth } from './AdminAuth'

const user = { id: 'admin-id', email: 'admin@example.test' } as User
const session = { user, access_token: 'test-token' } as Session
const renderAuth = () => render(<AdminAuth>{(user, signOut) => <div><h1>Private Dashboard</h1><p>{user.email}</p><button onClick={() => void signOut()}>Sign out</button></div>}</AdminAuth>)
const emit = async (event: string, next: Session | null) => { await act(async () => { mocks.listener?.(event, next) }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.getUser.mockResolvedValue({ data: { user }, error: null })
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: user.id }, error: null })
  mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
  mocks.signOut.mockImplementation(async () => { mocks.listener?.('SIGNED_OUT', null); return { error: null } })
})
afterEach(cleanup)

describe('admin authentication boundary', () => {
  it('shows login without rendering inventory or checking admin rows when signed out', async () => {
    renderAuth()
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible()
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument()
  })

  it('validates a restored session before showing the Dashboard', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    let finish!: (result: unknown) => void
    mocks.maybeSingle.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderAuth()
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalled())
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
    await act(async () => { finish({ data: { user_id: user.id }, error: null }) })
    expect(await screen.findByText('Private Dashboard')).toBeVisible()
  })

  it('submits credentials to Supabase and waits for authorization', async () => {
    mocks.signInWithPassword.mockImplementation(async () => { mocks.listener?.('SIGNED_IN', session); return { error: null } })
    renderAuth()
    fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: user.email } })
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'test-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Private Dashboard')).toBeVisible()
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: user.email, password: 'test-password' })
  })

  it('rejects incorrect credentials and clears the password input', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } })
    renderAuth()
    fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: user.email } })
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('email or password is incorrect')
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
  })

  it('rejects a signed-in user who is not an approved admin', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    renderAuth()
    expect(await screen.findByText('Admin access required')).toBeVisible()
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
  })

  it('fails closed when database authorization is unavailable', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Table not available' } })
    renderAuth()
    expect(await screen.findByText('Unable to verify access')).toBeVisible()
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
  })

  it('does not trust a locally restored user when Auth rejects it', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Expired token' } })
    renderAuth()
    expect(await screen.findByText('Unable to verify access')).toBeVisible()
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
  })

  it('removes private content when signed out in another tab', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    renderAuth()
    await screen.findByText('Private Dashboard')
    await emit('SIGNED_OUT', null)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible()
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
  })

  it('signs out the current session and returns to login', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    renderAuth()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible()
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('does not reopen the app if an old access check completes after logout', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    let finish!: (result: unknown) => void
    mocks.maybeSingle.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderAuth()
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalled())
    await emit('SIGNED_OUT', null)
    await act(async () => { finish({ data: { user_id: user.id }, error: null }) })
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})
