import type { BarcodeFormat } from './types'

export const FORMATS: { id: BarcodeFormat; label: string }[] = [
  { id: 'EAN13', label: 'EAN-13' },
  { id: 'EAN8', label: 'EAN-8' },
  { id: 'UPC', label: 'UPC-A' },
  { id: 'CODE128', label: 'Code 128' },
  { id: 'CODE39', label: 'Code 39' },
  { id: 'ITF', label: 'ITF' },
  { id: 'QR', label: 'QR-код' },
]

export const formatLabel = (f: BarcodeFormat) => FORMATS.find((x) => x.id === f)?.label ?? f

/** Проверка контрольной цифры EAN/UPC. */
export function eanValid(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  let sum = 0
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)))
  return (10 - (sum % 10)) % 10 === check
}

export function detectFormat(code: string): BarcodeFormat {
  const c = code.replace(/\s/g, '')
  if (/^\d{13}$/.test(c) && eanValid(c)) return 'EAN13'
  if (/^\d{8}$/.test(c) && eanValid(c)) return 'EAN8'
  if (/^\d{12}$/.test(c) && eanValid(c)) return 'UPC'
  if (c.length > 40 || /[^\x20-\x7e]/.test(c)) return 'QR'
  return 'CODE128'
}

/** Формат ZXing → наш. */
export function fromZxing(name: string): BarcodeFormat {
  const map: Record<string, BarcodeFormat> = {
    EAN_13: 'EAN13',
    EAN_8: 'EAN8',
    UPC_A: 'UPC',
    CODE_128: 'CODE128',
    CODE_39: 'CODE39',
    ITF: 'ITF',
    QR_CODE: 'QR',
  }
  return map[name] ?? 'CODE128'
}

/** «4600517000000» → «4600 5170 0000 0» */
export function groupNumber(n: string) {
  const c = n.replace(/\s/g, '')
  if (c.length > 24) return c
  return c.replace(/(.{4})(?=.)/g, '$1 ')
}

export async function renderBarcode(svg: SVGSVGElement, value: string, format: BarcodeFormat): Promise<boolean> {
  const { default: JsBarcode } = await import('jsbarcode')
  const opts = { displayValue: false, margin: 0, width: 3, height: 150, background: 'transparent', lineColor: '#000' }
  try {
    JsBarcode(svg, value.replace(/\s/g, ''), { ...opts, format })
    return true
  } catch {
    try {
      JsBarcode(svg, value, { ...opts, format: 'CODE128' })
      return true
    } catch {
      return false
    }
  }
}

export async function qrSvg(value: string, margin = 0): Promise<string> {
  const { default: qrcode } = await import('qrcode-generator')
  const qr = qrcode(0, 'M')
  qr.addData(value, 'Byte')
  qr.make()
  return qr.createSvgTag({ cellSize: 4, margin, scalable: true })
}
