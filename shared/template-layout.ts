/**
 * Keep-clear insets of a template canvas (virtual units, short side 1080).
 *
 * Reels and Stories reserve the top for the account bar and roughly the lower
 * fifth for the caption, audio and action buttons, so tall canvases keep key
 * content out of those bands. Other canvases only keep a small margin.
 */
export function safeInsets(width: number, height: number) {
  return height / width > 1.5 ? { top: 240, bottom: 430 } : { top: 90, bottom: 90 }
}
