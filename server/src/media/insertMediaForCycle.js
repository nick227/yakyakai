import { prisma } from '../db/prisma.js'
import { EventTypes } from '../lib/eventTypes.js'

function buildQuery(prompt) {
  const raw = String(prompt || '').trim()
  return raw.length > 90 ? raw.slice(0, 90) : raw
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
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
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
  url.searchParams.set('maxResults', '1')
  url.searchParams.set('q', query)
  url.searchParams.set('key', apiKey)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`)
  const data = await res.json()
  const first = data?.items?.[0]
  const videoId = first?.id?.videoId
  if (!videoId) throw new Error('YouTube returned no videoId')

  return { videoId }
}

function buildImageHtml({ url }) {
  const safeUrl = String(url)
  return `<img src="${safeUrl}" class="w-full object-cover" loading="lazy" alt="">`
}

function buildVideoHtml({ videoId }) {
  const safeId = String(videoId)
  const href = `https://youtube.com/watch?v=${safeId}`
  const thumb = `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg`
  return `<a href="${href}" target="_blank" rel="noreferrer"><img src="${thumb}" class="w-full" loading="lazy" alt=""></a>`
}

async function isSessionBlocked(sessionId) {
  const s = await prisma.aiSession.findUnique({ where: { id: sessionId }, select: { status: true } })
  const status = s?.status ?? null
  return status === 'paused' || status === 'cancelled'
}

export async function insertMediaForCycle({ sessionId, cycle, prompt, publish }) {
  console.log('[media] insertMediaForCycle start', { sessionId, cycle })
  if (cycle % 2 !== 0) {
    console.log('[media] skip (odd cycle)', { sessionId, cycle })
    return
  }
  if (await isSessionBlocked(sessionId)) {
    console.log('[media] skip (session blocked)', { sessionId, cycle })
    return
  }

  const query = buildQuery(prompt)
  console.log('[media] query', { sessionId, cycle, query })
  let image
  let video
  try {
    ;[image, video] = await Promise.all([
      fetchUnsplashImage(query),
      fetchYouTubeVideo(query),
    ])
  } catch (err) {
    console.error('[media] fetch failed', { sessionId, cycle, error: err?.message || String(err) })
    return
  }

  if (await isSessionBlocked(sessionId)) {
    console.log('[media] abort (session blocked after fetch)', { sessionId, cycle })
    return
  }

  const imageHtml = buildImageHtml(image)
  const videoHtml = buildVideoHtml(video)

  const imageMsg = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: imageHtml,
      metadata: JSON.stringify({ isMedia: true, kind: 'image', provider: 'unsplash', cycle }),
    },
  })
  const videoMsg = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: videoHtml,
      metadata: JSON.stringify({ isMedia: true, kind: 'video', provider: 'youtube', cycle }),
    },
  })
  console.log('[media] inserted chat messages', { sessionId, cycle, imageMessageId: imageMsg.id, videoMessageId: videoMsg.id })

  if (!publish) return

  // Publish as normal OUTPUT events so the client appends to chat stream immediately.
  await publish(sessionId, EventTypes.OUTPUT, {
    index: -2,
    html: imageMsg.content,
    cycle,
    messageId: imageMsg.id,
    createdAt: imageMsg.createdAt.toISOString(),
    isMedia: true,
    kind: 'image',
    provider: 'unsplash',
  })
  await publish(sessionId, EventTypes.OUTPUT, {
    index: -1,
    html: videoMsg.content,
    cycle,
    messageId: videoMsg.id,
    createdAt: videoMsg.createdAt.toISOString(),
    isMedia: true,
    kind: 'video',
    provider: 'youtube',
  })
  console.log('[media] published output events', { sessionId, cycle })
}

