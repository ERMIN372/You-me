export function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH) as unknown as number[])
  }
  return btoa(bin)
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const utf8ToB64 = (s: string) => bytesToB64(new TextEncoder().encode(s))
export const b64ToUtf8 = (b64: string) => new TextDecoder().decode(b64ToBytes(b64))

export const b64url = (bytes: Uint8Array) => bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  return b64ToBytes((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
}

export async function blobToB64(blob: Blob): Promise<string> {
  return bytesToB64(new Uint8Array(await blob.arrayBuffer()))
}

/** Короткий неколлизионный-на-практике хэш строки (для сравнения содержимого). */
export function hash(s: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619)
    h2 = Math.imul(h2 ^ c, 2246822519)
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36)
}
