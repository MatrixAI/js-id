import type { Id } from './Id.js';
import type { bases as multiformatsBases } from 'multiformats/basics';
import * as base10 from 'multiformats/bases/base10';
import * as base16 from 'multiformats/bases/base16';
import * as base2 from 'multiformats/bases/base2';
import * as base256emoji from 'multiformats/bases/base256emoji';
import * as base32 from 'multiformats/bases/base32';
import * as base36 from 'multiformats/bases/base36';
import * as base58 from 'multiformats/bases/base58';
import * as base64 from 'multiformats/bases/base64';
import * as base8 from 'multiformats/bases/base8';
import * as identity from 'multiformats/bases/identity';
import { readEpochMilliseconds } from './clock.js';
import IdInternal from './Id.js';

const typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  Symbol.toStringTag,
)?.get;

/** Checks for a genuine Uint8Array, including arrays from another realm. */
function isUint8Array(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    (ArrayBuffer.isView(value) && typedArrayTag?.call(value) === 'Uint8Array')
  );
}

/** Returns secure Web Crypto bytes, chunking requests above 65,536 bytes. */
function randomBytes(size: number): Uint8Array {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new RangeError('Random byte size must be a nonnegative integer');
  }
  const bytes = new Uint8Array(size);
  if (bytes.length <= 65_536) {
    return globalThis.crypto.getRandomValues(bytes);
  }
  // Web Crypto limits each request to 65,536 bytes.
  for (let offset = 0; offset < bytes.length; offset += 65_536) {
    globalThis.crypto.getRandomValues(bytes.subarray(offset, offset + 65_536));
  }
  return bytes;
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

/** Returns up to size leading bits from the supplied bytes in big-endian order. */
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
 * Use the last timestamp to retain monotonicity over process restarts
 * Not strictly monotonic, which means the same number may be returned
 */
function timeSource(lastTs?: number): () => number {
  return lastTs == null
    ? readEpochMilliseconds
    : () => Math.max(lastTs, readEpochMilliseconds());
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

/** Compares byte length and contents, not object identity. */
function equals(id1: Uint8Array, id2: Uint8Array): boolean {
  if (id1.byteLength !== id2.byteLength) return false;
  return id1.every((byte, i) => byte === id2[i]);
}

/** Checks UUID length, version, and RFC variant without identifying a profile. */
function isUuidVersion(id: Uint8Array, version: number): boolean {
  return (
    id.byteLength === 16 && id[6] >>> 4 === version && (id[8] & 0xc0) === 0x80
  );
}

/** Reads an unsigned 48-bit big-endian integer from a byte array. */
function readUint48BE(bytes: Uint8Array, offset: number = 0): number {
  if (!Number.isInteger(offset) || offset < 0 || offset + 6 > bytes.length) {
    throw new RangeError('A 48-bit integer requires six available bytes');
  }
  let value = 0;
  for (let i = offset; i < offset + 6; i++) value = value * 256 + bytes[i];
  return value;
}

/** Writes an unsigned 48-bit integer in big-endian order into existing bytes. */
function writeUint48BE(
  bytes: Uint8Array,
  value: number,
  offset: number = 0,
): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + 6 > bytes.length) {
    throw new RangeError('A 48-bit integer requires six available bytes');
  }
  if (!Number.isSafeInteger(value) || value < 0 || value >= 2 ** 48) {
    throw new RangeError('Value must be an unsigned 48-bit integer');
  }
  for (let i = offset + 5; i >= offset; i--) {
    bytes[i] = value % 256;
    value = Math.floor(value / 256);
  }
}

/** Returns a binary string with one code unit per byte, not UTF-8 text. */
function toString(id: Uint8Array): string {
  // Spreading a large array into one call exceeds runtime argument limits.
  const chunkSize = 8192;
  if (id.length <= chunkSize) return String.fromCharCode(...id);
  let binary = '';
  for (let offset = 0; offset < id.length; offset += chunkSize) {
    binary += String.fromCharCode(...id.subarray(offset, offset + chunkSize));
  }
  return binary;
}

/** Copies binary-string code units into bytes using typed-array conversion. */
function fromString(idString: string): Id {
  const id = IdInternal.create(idString.length);
  for (let i = 0; i < idString.length; i++) {
    id[i] = idString.charCodeAt(i);
  }
  return id;
}

/** Returns a JSON-compatible object containing an independent byte array. */
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

/** Encodes exactly 16 bytes as lowercase UUID text without validating a profile. */
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

/** Parses canonical UUID syntax without restricting version or variant bits. */
function fromUUID(uuid: string): Id | undefined {
  if (
    uuid.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      uuid,
    )
  ) {
    return;
  }
  const uuidHex = uuid.split('-').join('');
  return IdInternal.create(hex2bytes(uuidHex).buffer);
}

type MultibaseFormats = keyof typeof multiformatsBases;
type Codec = {
  prefix: string;
  encode(bytes: Uint8Array): string;
  decode(text: string): Uint8Array;
};

const bases: Record<MultibaseFormats, Codec> = {
  ...identity,
  ...base2,
  ...base8,
  ...base10,
  ...base16,
  ...base32,
  ...base36,
  ...base58,
  ...base64,
  ...base256emoji,
};

const basesByPrefix: Record<string, Codec> = {};
for (const k in bases) {
  const codec = bases[k];
  basesByPrefix[codec.prefix] = codec;
}

/**
 * Encodes bytes using a supported multibase codec and its prefix.
 */
function toMultibase(id: Uint8Array, format: MultibaseFormats): string {
  const codec = bases[format];
  return codec.encode(id);
}

/**
 * Decodes bytes using a supported multibase prefix. This does not validate any
 * CID, multihash, UUID, or other structure carried by those bytes.
 */
function fromMultibase(idString: string): Id | undefined {
  const firstCodePoint = idString.codePointAt(0);
  const prefix =
    firstCodePoint == null ? '' : String.fromCodePoint(firstCodePoint);
  const codec = basesByPrefix[prefix];
  if (codec == null) {
    return;
  }
  let buffer: Uint8Array;
  try {
    buffer = codec.decode(idString);
  } catch {
    return;
  }
  return IdInternal.create(buffer);
}

const sortableBase64Alphabet =
  '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

/** Encodes bytes as unpadded Base64sort without a multibase prefix. */
function toSortableBase64(id: Uint8Array): string {
  let output = '';
  let accumulator = 0;
  let bits = 0;
  for (const byte of id) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += sortableBase64Alphabet[(accumulator >> bits) & 0x3f];
      accumulator &= (1 << bits) - 1;
    }
  }
  if (bits > 0) {
    output += sortableBase64Alphabet[accumulator << (6 - bits)];
  }
  return output;
}

/** Encodes Base64sort with the selected draft padding character. */
function toSortableBase64Padded(id: Uint8Array, padding: '=' | '~'): string {
  if (padding !== '=' && padding !== '~') {
    throw new TypeError('Padding must be = or ~');
  }
  const encoded = toSortableBase64(id);
  return encoded + padding.repeat((4 - (encoded.length % 4)) % 4);
}

/** Decodes unpadded or consistently padded Base64sort with canonical pad bits. */
function fromSortableBase64(encoded: string): Id | undefined {
  let dataLength = encoded.length;
  const padding = encoded.endsWith('=')
    ? '='
    : encoded.endsWith('~')
      ? '~'
      : '';
  if (padding !== '') {
    while (dataLength > 0 && encoded[dataLength - 1] === padding) dataLength--;
    const paddingLength = encoded.length - dataLength;
    if (
      encoded.length % 4 !== 0 ||
      paddingLength > 2 ||
      paddingLength !== (4 - (dataLength % 4)) % 4
    ) {
      return;
    }
  }
  if (dataLength % 4 === 1) return;
  const result = IdInternal.create(Math.floor((dataLength * 6) / 8));
  let accumulator = 0;
  let bits = 0;
  let offset = 0;
  for (const character of encoded.slice(0, dataLength)) {
    const value = sortableBase64Alphabet.indexOf(character);
    if (value < 0) return;
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result[offset++] = (accumulator >> bits) & 0xff;
      accumulator &= (1 << bits) - 1;
    }
  }
  if (accumulator !== 0) return;
  return result;
}

const typeIdAlphabet = '0123456789abcdefghjkmnpqrstvwxyz';

function isTypeIdPrefix(prefix: string): boolean {
  return (
    prefix.length <= 63 &&
    (prefix === '' ||
      (!/[^a-z_]/.test(prefix) &&
        prefix[0] !== '_' &&
        prefix[prefix.length - 1] !== '_'))
  );
}

/** Encodes 16 supplied UUID bytes as TypeID 0.3, retaining a semantic prefix. */
function toTypeId(id: Uint8Array, prefix: string = ''): string {
  if (id.byteLength !== 16) {
    throw new RangeError('TypeID requires exactly 16 UUID bytes');
  }
  if (!isTypeIdPrefix(prefix)) {
    throw new TypeError('Invalid TypeID prefix');
  }
  let suffix = '';
  let accumulator = 0;
  // TypeID encodes two leading zero bits before the 128 UUID bits.
  let bits = 2;
  for (const byte of id) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      suffix += typeIdAlphabet[(accumulator >> bits) & 0x1f];
      accumulator &= (1 << bits) - 1;
    }
  }
  return prefix === '' ? suffix : `${prefix}_${suffix}`;
}

/** Decodes a canonical TypeID without assuming a particular UUID version. */
function fromTypeId(encoded: string): { prefix: string; id: Id } | undefined {
  const separator = encoded.lastIndexOf('_');
  const prefix = separator < 0 ? '' : encoded.slice(0, separator);
  const suffix = encoded.slice(separator + 1);
  if (
    (separator >= 0 && prefix === '') ||
    !isTypeIdPrefix(prefix) ||
    suffix.length !== 26
  ) {
    return;
  }
  const id = IdInternal.create(16);
  let accumulator = 0;
  let bits = -2;
  let offset = 0;
  for (let i = 0; i < suffix.length; i++) {
    const value = typeIdAlphabet.indexOf(suffix[i]);
    if (value < 0 || (i === 0 && value > 7)) return;
    accumulator = (accumulator << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      id[offset++] = (accumulator >> bits) & 0xff;
      accumulator &= (1 << bits) - 1;
    }
  }
  return { prefix, id };
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

/** Converts pairs of hexadecimal characters to bytes without strict validation. */
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
  isUint8Array,
  randomBytes,
  randomBits,
  nodeBits,
  timeSource,
  take,
  equals,
  isUuidVersion,
  readUint48BE,
  writeUint48BE,
  toString,
  fromString,
  toJSON,
  fromJSON,
  toUUID,
  fromUUID,
  toMultibase,
  fromMultibase,
  toSortableBase64,
  toSortableBase64Padded,
  fromSortableBase64,
  toTypeId,
  fromTypeId,
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
