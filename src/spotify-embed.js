// Spotify iFrame Embed API 로더 (싱글턴)
// https://developer.spotify.com/documentation/embeds/references/iframe-api
let apiPromise = null

export function getIframeAPI() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      window.onSpotifyIframeApiReady = (IFrameAPI) => resolve(IFrameAPI)
      const script = document.createElement('script')
      script.src = 'https://open.spotify.com/embed/iframe-api/v1'
      script.async = true
      document.body.appendChild(script)
    })
  }
  return apiPromise
}
