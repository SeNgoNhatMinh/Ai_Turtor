// navigator.clipboard only exists in secure contexts (HTTPS or localhost). The
// self-hosted LAN build is served over plain http://<server-ip>, so fall back to
// a hidden textarea + execCommand('copy'), which works in any context.
export async function copyText(text) {
  const value = String(text ?? '');
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Permission denied or document not focused: use the fallback below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard is unavailable');
}
