import { API_BASE_URL, blobRequest, request } from './apiClient';

export const ttsApi = {
  listVoices(courseId, classId, options = {}) {
    const params = new URLSearchParams({ courseId, classId });
    return request(`${API_BASE_URL}/tts/voices?${params}`, {
      signal: options.signal,
      skipUnauthorizedRedirect: true,
      retries: 1,
    });
  },

  synthesize(payload, options = {}) {
    return blobRequest(`${API_BASE_URL}/tts/synthesize`, {
      method: 'POST',
      body: payload,
      timeoutMs: 180000,
      signal: options.signal,
      // TTS is optional. A provider failure must not clear the chat session.
      skipUnauthorizedRedirect: true,
    });
  },

  readAiAnswer(payload, options = {}) {
    return this.synthesize(payload, options);
  },
};
