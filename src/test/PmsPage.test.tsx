import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PmsPage } from '../pages/PmsPage'
import { PmsRepository, localDate, type PmsSession, type PmsRecord } from '../lib/pms'

const scanner = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }))
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { decodeFromVideoDevice = scanner.decode } }))
vi.mock('../lib/pms', async importOriginal => ({ ...await importOriginal<typeof import('../lib/pms')>(), PmsRepository: { sessions: vi.fn(), records: vi.fn(), create: vi.fn(), mark: vi.fn(), complete: vi.fn() } }))
const session: PmsSession = { id: 'session-one', service_date: '2026-08-12', service_type: 'Preventive maintenance', technician: 'IT Team', notes: '', created_by: 'admin', created_at: '2026-09-07T00:00:00Z', completed_at: null, completed_by: null }
const record: PmsRecord = { id: 'record-one', session_id: session.id, asset_id: 'asset-one', asset_tag: 'PC-01', qr_id: 'LIV-PC01', asset_name: 'Workstation', category: 'System Unit', location: 'F1 · Cashier', department: 'IT', method: 'qr', recorded_by: 'admin', recorded_at: '2026-09-07T00:00:00Z' }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><PmsPage inventoryAssets={[]} /></QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(PmsRepository.sessions).mockResolvedValue([session])
  vi.mocked(PmsRepository.records).mockResolvedValue([])
  scanner.decode.mockResolvedValue({ stop: scanner.stop })
})
describe('PMS scanning', () => {
  it('saves one QR detection to the current dated session and stops the camera', async () => {
    vi.mocked(PmsRepository.mark).mockImplementation(async () => {
      vi.mocked(PmsRepository.records).mockResolvedValue([record])
      return { record, already_recorded: false }
    })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Scan asset QR' }))
    await waitFor(() => expect(scanner.decode).toHaveBeenCalledOnce())
    const detected = scanner.decode.mock.calls[0][2]
    await act(async () => { detected({ getText: () => 'liveinv:qr:LIV-PC01' }); detected({ getText: () => 'liveinv:qr:LIV-PC01' }) })
    expect(PmsRepository.mark).toHaveBeenCalledExactlyOnceWith(session.id, 'liveinv:qr:LIV-PC01', 'qr')
    expect(await screen.findByRole('status')).toHaveTextContent('PC-01 marked maintained for Aug 12, 2026')
    expect(scanner.stop).toHaveBeenCalledOnce()
    expect(screen.queryByLabelText('PMS QR camera')).not.toBeInTheDocument()
  })
  it('stops a camera that finishes starting after the module is closed', async () => {
    let started!: (controls: { stop: () => void }) => void
    scanner.decode.mockImplementationOnce(() => new Promise(resolve => { started = resolve }))
    const view = mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Scan asset QR' }))
    await waitFor(() => expect(scanner.decode).toHaveBeenCalled())
    view.unmount()
    await act(async () => { started({ stop: scanner.stop }) })
    expect(scanner.stop).toHaveBeenCalledOnce()
    expect(PmsRepository.mark).not.toHaveBeenCalled()
  })
  it('shows a failed scan without marking the asset maintained', async () => {
    vi.mocked(PmsRepository.mark).mockRejectedValue(new Error('No registered asset matches this code.'))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Scan asset QR' }))
    await waitFor(() => expect(scanner.decode).toHaveBeenCalled())
    await act(async () => scanner.decode.mock.calls[0][2]({ getText: () => 'UNKNOWN' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No registered asset matches')
    expect(screen.getByText('No assets maintained yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Complete session' })).toBeDisabled()
  })
  it('falls back to code entry when camera permission is denied', async () => {
    scanner.decode.mockRejectedValueOnce(new Error('NotAllowedError'))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Scan asset QR' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Camera access is unavailable')
    expect(screen.getByLabelText('QR number or asset tag')).toBeEnabled()
  })
  it('does not offer marking controls for a completed session', async () => {
    vi.mocked(PmsRepository.sessions).mockResolvedValue([{ ...session, completed_at: '2026-09-07T01:00:00Z', completed_by: 'admin' }])
    mount()
    expect(await screen.findByText('This session is complete. Start a new session for additional maintenance.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan asset QR' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark maintained' })).not.toBeInTheDocument()
  })
  it('uses local calendar components for the default date', () => {
    expect(localDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})
