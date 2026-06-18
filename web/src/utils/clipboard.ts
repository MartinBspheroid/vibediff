/**
 * Copies text to the clipboard. Prefers the async Clipboard API (secure
 * contexts), and falls back to a hidden textarea + execCommand for insecure
 * contexts — e.g. accessing the server over http on a non-localhost host
 * (`vibediff -host 0.0.0.0`), where `navigator.clipboard` is undefined.
 * Returns whether the copy succeeded.
 */
export async function copyText(text: string): Promise<boolean> {
  // navigator.clipboard is typed as always-present, but is genuinely undefined
  // in insecure contexts, so this runtime guard is intentional.
  const clip: Clipboard | undefined = navigator.clipboard
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (clip?.writeText) {
    try {
      await clip.writeText(text)
      return true
    } catch {
      // Clipboard API present but blocked (e.g. permissions); try the fallback.
    }
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  let ok = false
  try {
    // execCommand is deprecated, but it is the only clipboard path available in
    // insecure contexts where the async Clipboard API is unavailable.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }

  document.body.removeChild(textarea)
  return ok
}
