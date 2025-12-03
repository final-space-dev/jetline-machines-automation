import '@testing-library/jest-dom/vitest';

const filter = (...args: unknown[]) => {
  const msg = args[0];
  if (typeof msg === 'string' && msg.includes('non-boolean attribute `jsx`')) {
    return;
  }
  return null;
};

const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (filter(...args) === null) return;
  originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (filter(...args) === null) return;
  originalWarn(...args);
};
