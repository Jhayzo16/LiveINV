import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import { SystemModulePage } from '../pages/SystemPages'

vi.mock('../lib/repositories', () => ({
  AssetRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    update: vi.fn()
  },
  ConsumableRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn()
  }
}))

describe('SystemModulePage', () => {
  it('renders loading state initially', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><SystemModulePage module="dashboard" /></QueryClientProvider>)
    expect(screen.getByText(/Loading inventory/i)).toBeInTheDocument()
  })

  it('renders consumables as receipt records without assignment controls', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><SystemModulePage module="consumables" /></QueryClientProvider>)
    expect(await screen.findByRole('heading', { name: 'Consumables' })).toBeInTheDocument()
    expect(screen.getByText(/They do not have QR asset tags and cannot be assigned/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record received stock/i })).toBeInTheDocument()
  })
})
