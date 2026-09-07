import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetQrCode } from './asset-qr-code'

const { encode } = vi.hoisted(() => ({ encode: vi.fn<(...args: unknown[]) => Promise<string>>() }))
vi.mock('qrcode', () => ({ default: { toDataURL: encode } }))

describe('AssetQrCode', () => {
  beforeEach(() => { encode.mockReset() })

  it('uses the scanner token and displays both identifying numbers', async () => {
    encode.mockResolvedValue('data:image/png;base64,test')
    render(<AssetQrCode tag="AP-OR-03" qrId="LIV-TEST0" />)
    expect(await screen.findByRole('img', { name: 'QR code for AP-OR-03' })).toHaveAttribute('src', 'data:image/png;base64,test')
    expect(encode).toHaveBeenCalledWith('liveinv:qr:LIV-TEST0', expect.objectContaining({ margin: 2, errorCorrectionLevel: 'H' }))
    expect(screen.getByText('LIV-TEST0')).toBeInTheDocument()
    expect(screen.getByText('AP-OR-03')).toBeInTheDocument()
  })

  it('never shows the previous device QR when selection changes during encoding', async () => {
    let completeFirst!: (url: string) => void
    encode.mockImplementationOnce(() => new Promise<string>(resolve => { completeFirst = resolve }))
    encode.mockResolvedValueOnce('data:image/png;base64,second')
    const { rerender } = render(<AssetQrCode tag="FIRST" qrId="LIV-FIRST" />)
    rerender(<AssetQrCode tag="SECOND" qrId="LIV-SECOND" />)
    expect(await screen.findByRole('img', { name: 'QR code for SECOND' })).toHaveAttribute('src', 'data:image/png;base64,second')
    await act(async () => completeFirst('data:image/png;base64,first'))
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,second')
    rerender(<AssetQrCode tag="THIRD" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('No QR code recorded')).toBeInTheDocument()
  })

  it('keeps the QR number readable when image generation fails', async () => {
    encode.mockRejectedValue(new Error('Encoding failed'))
    render(<AssetQrCode tag="AP-OR-03" qrId="LIV-TEST0" />)
    expect(await screen.findByText('QR image unavailable. Use the QR number below.')).toBeInTheDocument()
    expect(screen.getByText('LIV-TEST0')).toBeInTheDocument()
  })
})
