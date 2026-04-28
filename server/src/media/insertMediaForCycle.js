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
  if (cycle % 2 !== 0) return
  if (await isSessionBlocked(sessionId)) return

  const query = buildQuery(prompt)
  const [image, video] = await Promise.all([
    fetchUnsplashImage(query),
    fetchYouTubeVideo(query),
  ])

  if (await isSessionBlocked(sessionId)) return

  const imageHtml = buildImageHtml(image)
  const videoHtml = buildVideoHtml(video)

  const created = await prisma.chatMessage.createMany({
    data: [
      {
        sessionId,
        role: 'ASSISTANT',
        content: imageHtml,
        metadata: JSON.stringify({ isMedia: true, kind: 'image', provider: 'unsplash', cycle }),
      },
      {
        sessionId,
        role: 'ASSISTANT',
        content: videoHtml,
        metadata: JSON.stringify({ isMedia: true, kind: 'video', provider: 'youtube', cycle }),
      },
    ],
  })
  void created

  if (!publish) return

  // Publish as normal OUTPUT events so the client appends to chat stream immediately.
  const saved = await prisma.chatMessage.findMany({
    where: { sessionId, role: 'ASSISTANT', metadata: { contains: '\"isMedia\":true' } },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })
  const inChrono = saved.slice().reverse()
  for (const msg of inChrono) {
    const meta = JSON.parse(msg.metadata || '{}')
    await publish(sessionId, EventTypes.OUTPUT, {
      index: meta.kind === 'image' ? -2 : -1,
      html: msg.content,
      cycle,
      messageId: msg.id,
      createdAt: msg.createdAt.toISOString(),
      isMedia: true,
      kind: meta.kind,
      provider: meta.provider,
    })
  }
}

