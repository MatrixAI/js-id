import type { Codec } from 'multiformats/bases/base';

import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { bases } from 'multiformats/basics';

/**
 * Gets random bytes as Uint8Array
 */
function randomBytes(size: number): Uint8Array {
  return crypto.randomBytes(size);
}

/**
 * Gets random bit string
 */
function randomBits(
  randomBytes: (sizeBytes: number) => Uint8Array,
  size: number,
): string {
  const bytes = randomBytes(Math.ceil(size / 8));
  const bits = [...bytes].map((n) => dec2bin(n, 8)).join('');
  return bits.substr(0, size);
}

function nodeBits(nodeBytes: ArrayBuffer, size: number): string {
  const bytes = new Uint8Array(
    nodeBytes,
    0,
    Math.min(nodeBytes.byteLength, Math.ceil(size / 8)),
  );
  const bits = [...bytes].map((n) => dec2bin(n, 8)).join('');
  return bits.substr(0, size);
}

/**
 * Monotonic system time in milliseconds as a floating point number
 * Use last timestamp this to ensure monotonocity is preserved over process restarts
 * Not strictly monotonic, which means the same number may be returned
 */
function timeSource(lastTs?: number): () => number {
  // `performance.now()` is weakly monotonic
  let origin: number;
  if (lastTs != null && performance.timeOrigin <= lastTs) {
    origin = lastTs;
    return () => {
      let now = origin + performance.now();
      if (now === lastTs) {
        // Only needed if performance.now() returns 0
        // this means no time has elapsed and now is equal to lastTs
        // plus 1 assumes lastTs integer-part represents the maximum precision
        // so 1 is the smallest unit of time to be added
        now += 1;
      }
      return now;
    };
  } else {
    origin = performance.timeOrigin;
    return () => origin + performance.now();
  }
}

/**
 * Take n items from an iterator
 */
function* take<T>(g: Iterator<T>, l: number): Generator<T> {
  for (let i = 0; i < l; i++) {
    const item = g.next();
    if (item.done) return;
    yield item.value;
  }
}

/**
 * Encodes Uint8Array as UUID string
 */
function toUUID(bytes: Uint8Array): string {
  const uuidHex = bytes2hex(bytes);
  return [
    uuidHex.substr(0, 8),
    uuidHex.substr(8, 4),
    uuidHex.substr(12, 4),
    uuidHex.substr(16, 4),
    uuidHex.substr(20, 12),
  ].join('-');
}

type MultibaseFormats = keyof typeof bases;

const basesByPrefix: Record<string, Codec<string, string>> = {};
for (const k in bases) {
  const codec = bases[k];
  basesByPrefix[codec.prefix] = codec;
}

function toMultibase(idBytes: ArrayBuffer, format: MultibaseFormats): string {
  const codec = bases[format];
  return codec.encode(new Uint8Array(idBytes));
}

function fromMultibase(idString: string): ArrayBuffer | undefined {
  const prefix = idString[0];
  const codec = basesByPrefix[prefix];
  if (codec == null) {
    return;
  }
  return codec.decode(idString).buffer;
}

/**
 * Encodes Uint8Array to hex string
 */
function bytes2hex(bytes: Uint8Array): string {
  return [...bytes].map((n) => dec2hex(n, 2)).join('');
}

function hex2bytes(hex: string): Uint8Array {
  const numbers = strChunks(hex, 2).map((b) => parseInt(b, 16));
  return new Uint8Array(numbers);
}

/**
 * Encodes Uint8Array to bit string
 */
function bytes2bin(bytes: Uint8Array): string {
  return [...bytes].map((n) => dec2bin(n, 8)).join('');
}

/**
 * Decodes bit string to Uint8Array
 */
function bin2bytes(bin: string): Uint8Array {
  const numbers = strChunks(bin, 8).map((b) => parseInt(b, 2));
  return new Uint8Array(numbers);
}

/**
 * Encodes positive base 10 numbers to bit string
 * Will output bits in big-endian order
 */
function dec2bin(dec: number, size: number): string {
  dec %= 2 ** size;
  // `>>>` coerces dec to unsigned integer
  return (dec >>> 0).toString(2).padStart(size, '0');
}

/**
 * Encodes positive base 10 numbers to hex string
 * Will output hex in big-endian order
 */
function dec2hex(dec: number, size: number): string {
  dec %= 16 ** size;
  // `>>>` coerces dec to unsigned integer
  return (dec >>> 0).toString(16).padStart(size, '0');
}

/**
 * Chunks strings into same size chunks
 * The last chunk will be smaller if a clean division is not possible
 */
function strChunks(str: string, size: number): Array<string> {
  const chunkCount = Math.ceil(str.length / size);
  const chunks = new Array(chunkCount);
  let i = 0;
  let o = 0;
  for (; i < chunkCount; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }
  return chunks;
}

/**
 * Round to number of decimal points
 */
function roundPrecise(num: number, digits: number = 0, base: number = 10) {
  const pow = Math.pow(base, digits);
  return Math.round((num + Number.EPSILON) * pow) / pow;
}

/**
 * Converts floating point number to a fixed point tuple
 * Size is number of bits allocated for the fractional
 * Precision dictates a fixed number of decimal places for the fractional
 */
function toFixedPoint(
  floating: number,
  size: number,
  precision?: number,
): [number, number] {
  const integer = Math.trunc(floating);
  let fractional: number;
  if (precision == null) {
    fractional = floating % 1;
  } else {
    fractional = roundPrecise(floating % 1, precision);
  }
  const fractionalFixed = Math.round(fractional * 2 ** size);
  return [integer, fractionalFixed];
}

/**
 * Converts fixed point tuple to floating point number
 * Size is number of bits allocated for the fractional
 * Precision dictates a fixed number of decimal places for the fractional
 */
function fromFixedPoint(
  [integer, fractionalFixed]: [number, number],
  size: number,
  precision?: number,
): number {
  let fractional: number;
  if (precision == null) {
    fractional = fractionalFixed / 2 ** size;
  } else {
    fractional = roundPrecise(fractionalFixed / 2 ** size, precision);
  }
  return integer + fractional;
}

export {
  randomBytes,
  randomBits,
  nodeBits,
  timeSource,
  take,
  toUUID,
  toMultibase,
  fromMultibase,
  bytes2hex,
  hex2bytes,
  bytes2bin,
  bin2bytes,
  dec2bin,
  dec2hex,
  strChunks,
  roundPrecise,
  toFixedPoint,
  fromFixedPoint,
};

export type { MultibaseFormats };
