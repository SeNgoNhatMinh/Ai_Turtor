import { env } from '../config/env';
import { httpClient, httpRequest } from './httpClient';

export const API_BASE_URL = env.apiBaseUrl;

function stripBaseUrl(url) {
  const value = String(url || '');
  if (value.startsWith(API_BASE_URL)) {
    return value.slice(API_BASE_URL.length) || '/';
  }
  return value;
}

export async function request(url, options = {}) {
  const { headers, body, method = 'GET', signal, responseType } = options;
  let parsedBody = body;
  if (typeof body === 'string' && headers?.['Content-Type']?.includes('application/json')) {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = body;
    }
  }

  return httpRequest(stripBaseUrl(url), {
    method,
    headers,
    body: parsedBody,
    signal,
    responseType,
  });
}

export async function uploadRequest(url, formData, errorPrefix = "Upload failed") {
  try {
    return await httpClient.upload(stripBaseUrl(url), formData);
  } catch (error) {
    error.message = error.message || errorPrefix;
    throw error;
  }
}

export async function blobRequest(url) {
  return httpClient.blob(stripBaseUrl(url));
}
