// Cloudflare Pages Function — Spotify 공개 임베드 페이지에서 트랙 목록 추출
// (신규 개발자 앱은 공식 API가 403이라 dev 서버와 동일한 우회를 배포 환경에도 제공)
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!/^[A-Za-z0-9]+$/.test(id)) return Response.json({})

  try {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
      headers: { 'User-Agent': BROWSER_UA },
    })
    if (!res.ok) return Response.json({})
    const html = await res.text()
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>(.*?)<\/script>/s)
    if (!m) return Response.json({})
    const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity
    if (!Array.isArray(entity?.trackList)) return Response.json({})
    return Response.json({
      name: entity.name || '',
      tracks: entity.trackList
        .filter((t) => t.uri && t.isPlayable !== false)
        .map((t) => ({
          id: t.uri.split(':').pop(),
          name: t.title || '',
          artists: t.subtitle ? [{ name: t.subtitle }] : [],
          album: null,
          duration_ms: t.duration || 0,
        })),
    })
  } catch {
    return Response.json({})
  }
}
