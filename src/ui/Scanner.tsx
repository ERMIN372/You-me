import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'

export interface ScanResult {
  text: string
  format: string
}

/** Сканер штрихкодов/QR с камеры. Библиотека ZXing грузится только при открытии. */
export function Scanner({ onResult, onClose, hint }: { onResult: (r: ScanResult) => void; onClose: () => void; hint?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState(hint ?? 'Наведи камеру на штрихкод')
  const done = useRef(false)

  useEffect(() => {
    let controls: { stop: () => void } | undefined
    let cancelled = false
    ;(async () => {
      try {
        const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 })
        if (cancelled) return
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
          video.current!,
          (result) => {
            if (!result || done.current) return
            done.current = true
            controls?.stop()
            navigator.vibrate?.(40)
            onResult({ text: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()] })
          },
        )
        if (cancelled) controls.stop()
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        setMsg(name === 'NotAllowedError' ? 'Нет доступа к камере. Разреши в настройках iPhone или выбери фото.' : 'Камера недоступна — можно выбрать фото штрихкода.')
      }
    })()
    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [])

  const fromPhoto = async (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!f) return
    const url = URL.createObjectURL(f)
    try {
      const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser')
      const r = await new BrowserMultiFormatReader().decodeFromImageUrl(url)
      done.current = true
      onResult({ text: r.getText(), format: BarcodeFormat[r.getBarcodeFormat()] })
    } catch {
      setMsg('На фото не нашёл код. Попробуй крупнее и ровнее.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div class="scanner">
      <video ref={video} playsInline muted autoPlay />
      <div class="frame" />
      <div class="msg">{msg}</div>
      <div class="bar">
        <button class="btn ghost" onClick={() => file.current?.click()}>
          Из фото
        </button>
        <button class="btn" onClick={onClose}>
          Отмена
        </button>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={fromPhoto} />
    </div>
  )
}
