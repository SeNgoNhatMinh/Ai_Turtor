import { API_BASE_URL, request } from './apiClient';

const options = { skipUnauthorizedRedirect: true };

export const chapterMemoryApi = {
  snapshot(courseId) {
    const params = new URLSearchParams({ courseId });
    return request(`${API_BASE_URL}/tutor/chapter-memory?${params}`, options);
  },
  reload(courseId) {
    const params = new URLSearchParams({ courseId });
    return request(`${API_BASE_URL}/tutor/chapter-memory/reload?${params}`, {
      ...options,
      method: 'POST',
    });
  },
};
