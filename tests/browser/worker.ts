import { verifyRuntime } from './scenarios.js';

try {
  verifyRuntime();
  postMessage('passed');
} catch (error) {
  postMessage(`worker: ${error.stack ?? error}`);
}
