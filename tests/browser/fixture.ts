import { verifyRuntime } from './scenarios.js';

const result = document.getElementById('result')!;

try {
  verifyRuntime();
  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  });
  try {
    const outcome = await new Promise((resolve, reject) => {
      worker.onmessage = (event) => resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message));
    });
    if (outcome !== 'passed') throw new Error(String(outcome));
  } finally {
    worker.terminate();
  }
  result.textContent = 'PASS: browser document and dedicated worker';
  result.dataset.status = 'passed';
} catch (error) {
  result.textContent = `FAIL: ${error.stack ?? error}`;
  result.dataset.status = 'failed';
}
