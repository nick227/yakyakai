import { prisma } from '../db/prisma.js'
import { EventTypes } from '../lib/eventTypes.js'

function buildQuery(prompt, kind) {
  const words = String(prompt || '').trim().split(/\s+/).filter(Boolean)
  const shuffled = words.sort(() => Math.random() - 0.5)
  if (kind === 'video') return shuffled.join(' ').slice(0, 90)
  return shuffled.slice(0, 6).join(' ').slice(0, 90)
}

async function fetchUnsplashImage(query) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) throw new Error('Missing env: UNSPLASH_ACCESS_KEY')

  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '1')
  url.searchParams.set('orientation', 'landscape')
  url.searchParams.set('content_filter', 'high')

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
  })
  if (!res.ok) throw new Error(`Unsplash search failed: ${res.status}`)
  const data = await res.json()
  const first = data?.results?.[0]
  const imgUrl = first?.urls?.regular || first?.urls?.full || first?.urls?.raw
  if (!imgUrl) throw new Error('Unsplash returned no image url')
  return { url: imgUrl }
}

async function fetchYouTubeVideo(query) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('Missing env: YOUTUBE_API_KEY')

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '5')
  url.searchParams.set('q', query)
  url.searchParams.set('key', apiKey)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`)
  const data = await res.json()
  const items = data?.items?.filter((i) => i?.id?.videoId) || []
  if (!items.length) throw new Error('YouTube returned no videoId')
  const pick = items[Math.floor(Math.random() * items.length)]
  return { videoId: pick.id.videoId }
}

async function fetchGiphy(query) {
  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) throw new Error('Missing env: GIPHY_API_KEY')

  const url = new URL('https://api.giphy.com/v1/gifs/search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '1')
  url.searchParams.set('rating', 'g')
  url.searchParams.set('lang', 'en')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Giphy search failed: ${res.status}`)
  const data = await res.json()
  const first = data?.data?.[0]
  const gifUrl = first?.images?.fixed_height?.url
  const title = first?.title || ''
  if (!gifUrl) throw new Error('Giphy returned no gif url')
  return { gifUrl, title }
}

function buildGiphyHtml({ gifUrl, title }) {
  const safeUrl = String(gifUrl)
  const safeTitle = String(title).replace(/"/g, '&quot;')
  return `<img src="${safeUrl}" class="w-full" loading="lazy" alt="${safeTitle}">`
}

function buildImageHtml({ url }) {
  return `<img src="${String(url)}" class="w-full object-cover" loading="lazy" alt="">`
}

function buildVideoHtml({ videoId }) {
  const safeId = String(videoId)
  return `<iframe src="https://www.youtube.com/embed/${safeId}" class="w-full aspect-video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
}

async function isSessionBlocked(sessionId) {
  const s = await prisma.aiSession.findUnique({ where: { id: sessionId }, select: { status: true } })
  const status = s?.status ?? null
  return status === 'paused' || status === 'cancelled'
}

export async function insertMediaForCycle({ sessionId, cycle, prompt, publish, kind }) {
  console.log('[media] insertMediaForCycle start', { sessionId, cycle, kind })
  if (await isSessionBlocked(sessionId)) {
    console.log('[media] skip (session blocked)', { sessionId, cycle })
    return
  }

  const existing = await prisma.aiMediaItem.findUnique({
    where: { sessionId_cycle_kind: { sessionId, cycle, kind } },
  })
  if (existing) {
    console.log('[media] skip (already inserted)', { sessionId, cycle, kind })
    return
  }

  const query = buildQuery(prompt, kind)
  console.log('[media] query', { sessionId, cycle, kind, query })

  let asset
  try {
    if (kind === 'image') asset = await fetchUnsplashImage(query)
    else if (kind === 'video') asset = await fetchYouTubeVideo(query)
    else asset = await fetchGiphy(query)
  } catch (err) {
    console.error('[media] fetch failed', { sessionId, cycle, kind, error: err?.message || String(err) })
    return
  }

  if (await isSessionBlocked(sessionId)) {
    console.log('[media] abort (session blocked after fetch)', { sessionId, cycle, kind })
    return
  }

  const html = kind === 'image' ? buildImageHtml(asset) : kind === 'video' ? buildVideoHtml(asset) : buildGiphyHtml(asset)
  const provider = kind === 'image' ? 'unsplash' : kind === 'video' ? 'youtube' : 'giphy'
  const providerAssetId = kind === 'image' ? asset.url : kind === 'video' ? asset.videoId : asset.gifUrl

  await prisma.aiMediaItem.create({
    data: { sessionId, cycle, kind, provider, query, providerAssetId, assetJson: JSON.stringify(asset), htmlContent: html },
  }).catch(() => {})

  const msg = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: html,
      metadata: JSON.stringify({ isMedia: true, kind, provider, cycle }),
    },
  })
  console.log('[media] inserted chat message', { sessionId, cycle, kind, messageId: msg.id })

  if (!publish) return

  await publish(sessionId, EventTypes.OUTPUT, {
    index: kind === 'image' ? -2 : -1,
    html: msg.content,
    cycle,
    messageId: msg.id,
    createdAt: msg.createdAt.toISOString(),
    isMedia: true,
    kind,
    provider,
  })
  console.log('[media] published output event', { sessionId, cycle, kind })
}
