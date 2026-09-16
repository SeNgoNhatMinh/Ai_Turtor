import '@testing-library/jest-dom/vitest';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { appQueryClient } from '../src/app/queryClient.js';

vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal();

  const withQueryClient = (options = {}) => {
    const UserWrapper = options.wrapper;
    const QueryWrapper = ({ children }) => React.createElement(
      QueryClientProvider,
      { client: appQueryClient },
      UserWrapper ? React.createElement(UserWrapper, null, children) : children,
    );
    return { ...options, wrapper: QueryWrapper };
  };

  return {
    ...actual,
    render: (ui, options) => actual.render(ui, withQueryClient(options)),
    renderHook: (callback, options) => actual.renderHook(callback, withQueryClient(options)),
  };
});

afterEach(() => {
  cleanup();
  appQueryClient.clear();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
window.cancelAnimationFrame = (id) => window.clearTimeout(id);

if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock-page';
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}
