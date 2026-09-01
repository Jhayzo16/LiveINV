import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SystemModulePage } from '../pages/SystemPages'

vi.mock('../lib/repositories', () => ({
  AssetRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    update: vi.fn()
  }
}))

describe('SystemModulePage', () => {
  it('renders loading state initially', () => {
    render(<SystemModulePage module="dashboard" />)
    expect(screen.getByText(/Loading inventory/i)).toBeInTheDocument()
  })
})
