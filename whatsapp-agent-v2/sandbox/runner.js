// sandbox/runner.js
// Eksekusi kode yang dihasilkan BYTE di environment terisolasi — aman dari fs, process, exec
const { VM } = require('vm2');

const FORBIDDEN_PATTERNS = [
  'rm -rf', 'process.exit', 'eval(', 'exec(',
  'spawn(', 'child_process', '__dirname', '__filename',
  'require(', 'import(', 'fs.', 'net.', 'os.'
];

function isSafe(code) {
  return !FORBIDDEN_PATTERNS.some(p => code.includes(p));
}

/**
 * Test kode di sandbox sebelum disimpan ke production
 * @param {string} code — kode module.exports = { handler: async () => {} }
 * @param {object} testInput — input untuk test handler
 * @returns {{ success, output, error, durationMs }}
 */
async function testInSandbox(code, testInput = {}) {
  const start = Date.now();

  if (!isSafe(code)) {
    return { success: false, error: 'Kode mengandung operasi berbahaya', durationMs: 0 };
  }

  try {
    const vm = new VM({
      timeout: parseInt(process.env.SANDBOX_TIMEOUT_MS) || 5000,
      allowAsync: true,
      sandbox: {
        fetch: (...args) => import('node-fetch').then(m => m.default(...args)),
        console: {
          log: () => {},
          error: () => {},
          warn: () => {}
        },
        setTimeout,
        clearTimeout,
        JSON,
        Math,
        Date,
        parseInt,
        parseFloat,
        encodeURIComponent,
        decodeURIComponent,
        Promise
      }
    });

    // Wrap kode supaya bisa di-eval
    const wrapped = `
      (async () => {
        ${code.replace('module.exports =', 'const __skill =')}
        return await __skill.handler(${JSON.stringify(testInput)});
      })()
    `;

    const output = await vm.run(wrapped);
    const durationMs = Date.now() - start;

    return { success: true, output: String(output), durationMs };
  } catch (err) {
    return { success: false, error: err.message, durationMs: Date.now() - start };
  }
}

/**
 * Syntax check tanpa eksekusi
 */
function syntaxCheck(code) {
  try {
    new Function(code);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = { testInSandbox, syntaxCheck, isSafe };
