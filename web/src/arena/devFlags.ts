/**
 * Live toggles and stats for the /?dev=mars view. Read every frame by the
 * cutout; written by the dev panel. No effect unless something changes them.
 */
export const arenaDev = {
  /** Paint the raw person mask in red over the camera image. */
  showMask: false,
  /** Show the full camera instead of the Mars cutout. */
  showCamera: false,
  stats: {
    renderFps: 0,
    maskFps: 0,
    presence: 0,
    segmentation: 'waiting' as 'waiting' | 'ok' | 'failed',
  },
}
