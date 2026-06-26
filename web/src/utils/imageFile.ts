const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg']

/** True when the path looks like a previewable image (by extension). */
export function isImagePath(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return false
  return IMAGE_EXTENSIONS.includes(path.slice(dot + 1).toLowerCase())
}

/** URL of the raw image bytes for a side of the diff (server validates the path). */
export function imageBlobSrc(path: string, side: 'old' | 'new'): string {
  return `/api/blob/${encodeURIComponent(path)}?side=${side}`
}
