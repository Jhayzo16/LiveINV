import { act, configure, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import { SystemModulePage } from '../pages/SystemPages'
import { AssetRepository, ConsumableRepository } from '../lib/repositories'

// Initial inventory and module-specific records can each display a two-second loader.
configure({ asyncUtilTimeout: 6000 })
vi.setConfig({ testTimeout: 10000 })

vi.mock('../lib/repositories', () => ({
  AssetRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    update: vi.fn()
  },
  ConsumableRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    movements: vi.fn().mockResolvedValue([])
  }
}))

describe('SystemModulePage', () => {
  it.each(['dashboard', 'assets', 'assignments', 'qr', 'network', 'maintenance', 'reports', 'pms', 'consumables'] as const)('shows the spinner before %s records arrive', (module) => {
    vi.mocked(AssetRepository.getAll).mockImplementationOnce(() => new Promise(() => {}))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><SystemModulePage module={module} /></QueryClientProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('Loading inventory…')
    expect(screen.getByRole('button', { name: 'Loading inventory…' })).toBeDisabled()
    expect(screen.getByRole('status').querySelector('svg')).toHaveAttribute('data-icon', 'inline-start')
  })

  it('clears initial loading when records arrive and keeps content during background refresh', async () => {
    let finish!: (assets: []) => void
    vi.mocked(AssetRepository.getAll).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><SystemModulePage module="dashboard" /></QueryClientProvider>)
    expect(screen.queryByText('Registered assets')).not.toBeInTheDocument()
    await act(async () => finish([]))
    expect(await screen.findByText('Registered assets')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading inventory…' })).not.toBeInTheDocument()

    vi.mocked(AssetRepository.getAll).mockImplementationOnce(() => new Promise(() => {}))
    act(() => { void queryClient.invalidateQueries({ queryKey: ['assets'] }) })
    await waitFor(() => expect(queryClient.isFetching()).toBe(1))
    expect(screen.getByText('Registered assets')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading inventory…' })).not.toBeInTheDocument()
  })

  it('waits for consumable receipts before showing stock totals', async () => {
    let finish!: (receipts: []) => void
    vi.mocked(ConsumableRepository.getAll).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['assets'], [])
    render(<QueryClientProvider client={queryClient}><SystemModulePage module="consumables" /></QueryClientProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('Loading received stock…')
    expect(screen.queryByText('Total units received')).not.toBeInTheDocument()
    await act(async () => finish([]))
    expect(await screen.findByText('Total units received')).toBeInTheDocument()
    expect(screen.queryByText('Loading received stock…')).not.toBeInTheDocument()
  })

  it('renders consumables with system unit stock usage', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><SystemModulePage module="consumables" /></QueryClientProvider>)
    expect(await screen.findByRole('heading', { name: 'Consumables' })).toBeInTheDocument()
    expect(screen.getByText(/RAM and SSD stock linked to system units/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record received stock/i })).toBeInTheDocument()
  })
})
