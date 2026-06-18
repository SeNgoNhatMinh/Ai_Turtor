export const API_BASE_URL = 'http://localhost:8085/api';

export async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    let message = errorBody || res.statusText;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.error || parsed.message || message;
    } catch {
      // Keep the raw response text when the backend does not return JSON.
    }
    throw new Error(message);
  }
  return await res.json();
}

export async function uploadRequest(url, formData, errorPrefix = 'Upload failed') {
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`${errorPrefix}: ${res.status}`);
  return await res.json();
}
