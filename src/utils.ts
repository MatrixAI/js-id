import type { Codec } from 'multiformats/bases/base';
import type { Id } from './Id';

import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { bases } from 'multiformats/basics';
import IdInternal from './Id';

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
  const bits = [...bytes].map((n) => dec2bits(n, 8)).join('');
  return bits.substr(0, size);
}

function nodeBits(nodeBytes: Uint8Array, size: number): string {
  const bytes = nodeBytes.subarray(
    0,
    Math.min(nodeBytes.byteLength, Math.ceil(size / 8)),
  );
  const bits = [...bytes].map((n) => dec2bits(n, 8)).join('');
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

function equals(id1: Uint8Array, id2: Uint8Array): boolean {
  if (id1.byteLength !== id2.byteLength) return false;
  return id1.every((byte, i) => byte === id2[i]);
}

function toString(id: Uint8Array): string {
  return String.fromCharCode(...id);
}

function fromString(idString: string): Id {
  const id = IdInternal.create(idString.length);
  for (let i = 0; i < idString.length; i++) {
    id[i] = idString.charCodeAt(i);
  }
  return id;
}

function toJSON(id: IdInternal): { type: string; data: Array<number> } {
  return {
    type: IdInternal.name,
    data: [...id],
  };
}

/**
 * Converts JSON object as Id
 * This tries to strictly check that the object is equal to the output of `toJSON`
 * If the `data` array contains non-numbers, those bytes will become 0
 */
function fromJSON(idJSON: any): Id | undefined {
  if (typeof idJSON !== 'object' || idJSON == null) {
    return;
  }
  const keys = Object.getOwnPropertyNames(idJSON);
  if (keys.length !== 2 || !keys.includes('type') || !keys.includes('data')) {
    return;
  }
  if (idJSON.type !== IdInternal.name) {
    return;
  }
  if (!Array.isArray(idJSON.data)) {
    return;
  }
  return IdInternal.create(idJSON.data);
}

function toUUID(id: Uint8Array): string {
  if (id.byteLength !== 16) {
    throw new RangeError('UUID can only be created from buffers with 16 bytes');
  }
  const uuidHex = bytes2hex(id);
  return [
    uuidHex.substr(0, 8),
    uuidHex.substr(8, 4),
    uuidHex.substr(12, 4),
    uuidHex.substr(16, 4),
    uuidHex.substr(20, 12),
  ].join('-');
}

function fromUUID(uuid: string): Id | undefined {
  const uuidHex = uuid.split('-').join('');
  if (uuidHex.length !== 32) {
    return;
  }
  return IdInternal.create(hex2bytes(uuidHex).buffer);
}

type MultibaseFormats = keyof typeof bases;

const basesByPrefix: Record<string, Codec<string, string>> = {};
for (const k in bases) {
  const codec = bases[k];
  basesByPrefix[codec.prefix] = codec;
}

/**
 * Encodes an multibase ID string
 */
function toMultibase(id: Uint8Array, format: MultibaseFormats): string {
  const codec = bases[format];
  return codec.encode(id);
}

/**
 * Decodes a multibase encoded ID
 * Do not use this for generic multibase strings
 */
function fromMultibase(idString: string): Id | undefined {
  const prefix = idString[0];
  const codec = basesByPrefix[prefix];
  if (codec == null) {
    return;
  }
  let buffer: Uint8Array;
  try {
    buffer = codec.decode(idString);
  } catch (e) {
    return;
  }
  return IdInternal.create(buffer);
}

/**
 * Encodes as Buffer zero-copy
 */
function toBuffer(id: Uint8Array): Buffer {
  return Buffer.from(id.buffer, id.byteOffset, id.byteLength);
}

/**
 * Decodes as Buffer zero-copy
 */
function fromBuffer(idBuffer: Buffer): Id {
  return IdInternal.create(
    idBuffer.buffer,
    idBuffer.byteOffset,
    idBuffer.byteLength,
  );
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
function bytes2bits(bytes: Uint8Array): string {
  return [...bytes].map((n) => dec2bits(n, 8)).join('');
}

/**
 * Decodes bit string to Uint8Array
 */
function bits2bytes(bits: string): Uint8Array {
  const numbers = strChunks(bits, 8).map((b) => parseInt(b, 2));
  return new Uint8Array(numbers);
}

/**
 * Encodes positive base 10 numbers to bit string
 * Will output bits in big-endian order
 */
function dec2bits(dec: number, size?: number): string {
  if (dec < 0) throw RangeError('`dec` must be positive');
  if (size != null) {
    if (size < 0) throw RangeError('`size` must be positive');
    if (size === 0) return '';
    dec %= 2 ** size;
  } else {
    size = 0;
  }
  return dec.toString(2).padStart(size, '0');
}

/**
 * Encodes positive base 10 numbers to hex string
 * Will output hex in big-endian order
 */
function dec2hex(dec: number, size?: number): string {
  if (dec < 0) throw RangeError('`dec` must be positive');
  if (size != null) {
    if (size < 0) throw RangeError('`size` must be positive');
    if (size === 0) return '';
    dec %= 16 ** size;
  } else {
    size = 0;
  }
  return dec.toString(16).padStart(size, '0');
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
  let integer = Math.trunc(floating);
  let fractional: number;
  if (precision == null) {
    fractional = floating % 1;
  } else {
    fractional = roundPrecise(floating % 1, precision);
  }
  // If the fractional is rounded to 1
  // then it should be added to the integer
  if (fractional === 1) {
    integer += fractional;
    fractional = 0;
  }
  // Floor is used to round down to a number that can be represented by the bit size
  // if ceil or round was used, it's possible to return a number that would overflow the bit size
  // for example if 12 bits is used, then 4096 would overflow to all zeros
  // the maximum for 12 bit is 4095
  const fractionalFixed = Math.floor(fractional * 2 ** size);
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
  equals,
  toString,
  fromString,
  toJSON,
  fromJSON,
  toUUID,
  fromUUID,
  toMultibase,
  fromMultibase,
  toBuffer,
  fromBuffer,
  bytes2hex,
  hex2bytes,
  bytes2bits,
  bits2bytes,
  dec2bits,
  dec2hex,
  strChunks,
  roundPrecise,
  toFixedPoint,
  fromFixedPoint,
};

export type { MultibaseFormats };
