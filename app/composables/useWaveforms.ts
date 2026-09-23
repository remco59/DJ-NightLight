import type { BeatGrid } from '~~/shared/beat-grid'
import type { AudioClipItem } from '~~/shared/video-project'
import { MAX_DETAILED_SECONDS, loadWaveform, type Waveform } from '~/utils/audio-waveform'

// Detailed waveforms (and detected beat grids) per audio asset, shared by the
// timeline and the inspector. Loading happens in the browser only.

const waveforms = shallowReactive(new Map<string, Waveform>())
const failed = new Set<string>()

export function useWaveforms() {
  function ensure(asset: { id: string, url: string, durationMs: number | null }) {
    if (!import.meta.client || waveforms.has(asset.id) || failed.has(asset.id)) return
    // Very long sources (whole DJ mixes) keep the stored overview peaks.
    if ((asset.durationMs ?? 0) > MAX_DETAILED_SECONDS * 1000) return
    loadWaveform(asset.id, asset.url)
      .then(waveform => waveforms.set(asset.id, waveform))
      .catch(() => {
        // Undecodable in this browser: the stored overview peaks stay in use.
        failed.add(asset.id)
      })
  }

  /** The clip's hand-corrected grid, else the detected one. */
  function gridFor(item: AudioClipItem): BeatGrid | null {
    return item.beatGrid ?? waveforms.get(item.assetId)?.grid ?? null
  }

  return { waveforms, ensure, gridFor }
}
