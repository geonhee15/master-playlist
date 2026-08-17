// Cloudflare Pages Function — LRCLIB 가사 프록시 (배포 환경용, dev의 /api/lyrics와 동일)
const HEADERS = { 'User-Agent': 'MasterPlaylist/0.1 (personal project)' }

export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const q = {
    track: url.searchParams.get('track') || '',
    artist: url.searchParams.get('artist') || '',
    album: url.searchParams.get('album') || '',
    duration: url.searchParams.get('duration') || '',
  }

  let result = null
  try {
    const exact = new URLSearchParams({
      track_name: q.track,
      artist_name: q.artist,
      album_name: q.album,
      duration: q.duration,
    })
    let res = await fetch(`https://lrclib.net/api/get?${exact}`, { headers: HEADERS })
    if (res.ok) result = await res.json()

    if (!result?.syncedLyrics && !result?.plainLyrics) {
      const search = new URLSearchParams({ track_name: q.track, artist_name: q.artist })
      res = await fetch(`https://lrclib.net/api/search?${search}`, { headers: HEADERS })
      if (res.ok) {
        const list = await res.json()
        const dur = Number(q.duration) || 0
        const close = (x) => !dur || Math.abs((x.duration || 0) - dur) <= 3
        result =
          list.find((x) => x.syncedLyrics && close(x)) ||
          list.find((x) => x.syncedLyrics) ||
          list.find((x) => x.plainLyrics && close(x)) ||
          null
      }
    }
  } catch {
    result = null
  }
  return Response.json(result || {})
}
