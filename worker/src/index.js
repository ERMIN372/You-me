// You&Me — предпросмотр ссылок для «Хотелок».
// GET /preview?url=...  → { title, price, currency, image }
// GET /image?url=...    → картинка (с CORS), чтобы приложение сжало её и сохранило в ваш репо.
// Доступ только с ключом: заголовок X-Key == секрет KEY. Разрешённый Origin — переменная ORIGIN (например https://ermin372.github.io).

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

export default {
  async fetch(req, env) {
    const origin = env.ORIGIN || '*'
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'X-Key',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (!env.KEY || req.headers.get('X-Key') !== env.KEY) return json({ error: 'forbidden' }, 403, cors)

    const u = new URL(req.url)
    const target = u.searchParams.get('url')
    if (!target || !/^https?:\/\//i.test(target)) return json({ error: 'bad url' }, 400, cors)
    const host = new URL(target).hostname
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/.test(host)) return json({ error: 'bad host' }, 400, cors)

    try {
      if (u.pathname === '/image') return await image(target, cors)
      if (u.pathname === '/preview') return json(await preview(target), 200, cors)
      return json({ error: 'not found' }, 404, cors)
    } catch (e) {
      return json({ error: String(e?.message ?? e) }, 502, cors)
    }
  },
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } })
}

async function image(url, cors) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow' })
  const type = r.headers.get('content-type') || ''
  if (!r.ok || !type.startsWith('image/')) return json({ error: `image ${r.status}` }, 502, cors)
  const len = Number(r.headers.get('content-length') || 0)
  if (len > 15 * 1024 * 1024) return json({ error: 'too big' }, 413, cors)
  return new Response(r.body, { headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } })
}

async function preview(url) {
  const wb = url.match(/wildberries\.ru\/catalog\/(\d+)/)
  if (wb) {
    const r = await wildberries(wb[1]).catch(() => null)
    if (r?.title) return r
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Сайт ответил ${res.status}`)

  const meta = {}
  const ld = []
  let title = ''
  let inTitle = false
  let ldBuf = ''

  const rewritten = new HTMLRewriter()
    .on('meta', {
      element(el) {
        const k = (el.getAttribute('property') || el.getAttribute('name') || el.getAttribute('itemprop') || '').toLowerCase()
        const v = el.getAttribute('content')
        if (k && v && !(k in meta)) meta[k] = v
      },
    })
    .on('title', {
      element() {
        inTitle = true
      },
      text(t) {
        if (inTitle) title += t.text
        if (t.lastInTextNode) inTitle = false
      },
    })
    .on('script[type="application/ld+json"]', {
      text(t) {
        ldBuf += t.text
        if (t.lastInTextNode) {
          ld.push(ldBuf)
          ldBuf = ''
        }
      },
    })
    .transform(res)
  await rewritten.text()

  const out = {
    title: clean(meta['og:title'] || meta['twitter:title']),
    image: abs(meta['og:image'] || meta['og:image:secure_url'] || meta['twitter:image'], url),
    price: num(meta['product:price:amount'] || meta['og:price:amount'] || meta['price']),
    currency: (meta['product:price:currency'] || meta['og:price:currency'] || meta['pricecurrency'] || '').toUpperCase() || undefined,
  }

  for (const raw of ld) {
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      continue
    }
    const product = findProduct(data)
    if (!product) continue
    out.title ||= clean(product.name)
    const img = Array.isArray(product.image) ? product.image[0] : product.image?.url || product.image
    out.image ||= abs(img, url)
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers
    if (offer) {
      out.price ??= num(offer.price ?? offer.lowPrice)
      out.currency ||= offer.priceCurrency
    }
    break
  }
  out.title ||= clean(title)
  if (out.currency === 'RUR') out.currency = 'RUB'
  return out
}

function findProduct(d) {
  if (!d || typeof d !== 'object') return null
  if (Array.isArray(d)) {
    for (const x of d) {
      const p = findProduct(x)
      if (p) return p
    }
    return null
  }
  const t = d['@type']
  if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return d
  if (d['@graph']) return findProduct(d['@graph'])
  return null
}

// Wildberries отдаёт страницу через JS; пробуем их публичное API карточки. Может перестать работать без предупреждения.
async function wildberries(id) {
  for (const v of ['v4', 'v2']) {
    const r = await fetch(`https://card.wb.ru/cards/${v}/detail?appType=1&curr=rub&dest=-1257786&nm=${id}`, { headers: { 'User-Agent': UA } })
    if (!r.ok) continue
    const j = await r.json()
    const p = (j.products || j.data?.products || [])[0]
    if (!p) continue
    const kop = p.sizes?.[0]?.price?.product ?? p.salePriceU ?? p.priceU
    return { title: clean([p.brand, p.name].filter(Boolean).join(' ')), price: kop ? Math.round(kop) / 100 : undefined, currency: 'RUB' }
  }
  return null
}

const clean = (s) => (s ? String(s).replace(/\s+/g, ' ').trim().slice(0, 160) : undefined)
function num(s) {
  if (s === undefined || s === null || s === '') return undefined
  const n = Number(String(s).replace(/[\s ]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}
function abs(u, base) {
  if (!u) return undefined
  try {
    return new URL(u, base).href
  } catch {
    return undefined
  }
}
