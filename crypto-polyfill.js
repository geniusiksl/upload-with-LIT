// This module ensures that the Web Crypto API is available in the global scope
try {
  const { webcrypto } = require('node:crypto');
  if (webcrypto && typeof webcrypto.subtle?.encrypt === 'function') {
    if (!globalThis.window) globalThis.window = globalThis;
    if (!globalThis.self) globalThis.self = globalThis;
    if (!globalThis.crypto) globalThis.crypto = webcrypto;
    return;
  }
} catch (_) {
  
}


try {
  const { Crypto } = require('@peculiar/webcrypto');
  const webcrypto = new Crypto();
  if (webcrypto && typeof webcrypto.subtle?.encrypt === 'function') {
    if (!globalThis.window) globalThis.window = globalThis;
    if (!globalThis.self) globalThis.self = globalThis;
    if (!globalThis.crypto) globalThis.crypto = webcrypto;
  } else {
    throw new Error('Polyfill from @peculiar/webcrypto also lacks subtle.encrypt');
  }
} catch (e) {
  console.error(
    'FATAL: Web Crypto API is not available. Please ensure your Node.js version is >= 16 or you have installed \'@peculiar/webcrypto\'.',
    e
  );
  process.exit(1);
}
