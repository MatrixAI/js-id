import type { Id } from './Id.js';
import IdInternal from './Id.js';
import * as utils from './utils.js';

const maxTimestamp = 2 ** 48 - 1;
const payloadBits = 74;
const defaultSequenceBits = 12;
const defaultNodeBitsLimit = 62;
const lowPayloadMask = (1n << 62n) - 1n;

function assertFlake(id: Uint8Array): void {
  if (!utils.isUint8Array(id) || !utils.isUuidVersion(id, 8)) {
    throw new RangeError('Expected a 16-byte UUIDv8 flake');
  }
}

function assertAllocation(sequenceBits: number, nodeBits: number): void {
  if (
    !Number.isInteger(sequenceBits) ||
    sequenceBits < 1 ||
    sequenceBits > payloadBits ||
    !Number.isInteger(nodeBits) ||
    nodeBits < 0 ||
    nodeBits + sequenceBits > payloadBits
  ) {
    throw new RangeError('Sequence and node widths must fit in 74 bits');
  }
}

function readPayload(id: Uint8Array): bigint {
  assertFlake(id);
  let low = BigInt(id[8] & 0x3f);
  for (let i = 9; i < 16; i++) low = (low << 8n) | BigInt(id[i]);
  return (BigInt(((id[6] & 0x0f) << 8) | id[7]) << 62n) | low;
}

function readPrefix(bytes: Uint8Array, bits: number): bigint {
  const count = Math.ceil(bits / 8);
  let value = 0n;
  for (let i = 0; i < count; i++) value = (value << 8n) | BigInt(bytes[i]);
  return value >> BigInt(count * 8 - bits);
}

function bitMask(bits: number): bigint {
  return (1n << BigInt(bits)) - 1n;
}

/** Extracts the first 48 bits as Unix milliseconds after UUIDv8 validation. */
function extractTs(id: Uint8Array): number {
  assertFlake(id);
  return utils.readUint48BE(id);
}

/** Extracts the sequence using the externally known profile width, without precision loss. */
function extractSeq(
  id: Uint8Array,
  sequenceBits = defaultSequenceBits,
): bigint {
  assertAllocation(sequenceBits, 0);
  return readPayload(id) >> BigInt(payloadBits - sequenceBits);
}

/**
 * Extracts node bits into a new byte array, left-aligned with zero padding.
 * The profile widths must be supplied externally; UUIDv8 bits do not identify it.
 */
function extractNodeId(
  id: Uint8Array,
  { sequenceBits, nodeBits }: { sequenceBits: number; nodeBits: number },
): Uint8Array {
  assertAllocation(sequenceBits, nodeBits);
  const randomBits = payloadBits - sequenceBits - nodeBits;
  let value = (readPayload(id) >> BigInt(randomBits)) & bitMask(nodeBits);
  const bytes = new Uint8Array(Math.ceil(nodeBits / 8));
  value <<= BigInt(bytes.length * 8 - nodeBits);
  for (let i = bytes.length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

/**
 * Generates byte-sortable UUIDv8 values using a caller-selected bit allocation.
 *
 * Use when a consuming system explicitly needs embedded node identity or a
 * chosen sequence/randomness trade-off and can coordinate its profile and state.
 * Prefer IdSortable for interoperable UUIDv7 without node allocation, or
 * IdRandom when time-oriented ordering is not needed. This profile is custom:
 * UUIDv8 alone does not identify its layout, and ordering is not globally causal.
 *
 * Sortable UUIDv8 bit layout, in network byte order:
 *
 *     0                   1                   2                   3
 *     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |                         unix_ts_ms                            |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |          unix_ts_ms           |  1000 |    payload bits 0..11 |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |1 0|                    payload bits 12..41                    |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |                       payload bits 42..73                     |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *
 * The 74-bit payload is sequence, then node prefix, then random tail. A field
 * can cross the variant gap according to the selected widths.
 *
 * After the 48-bit Unix millisecond timestamp, 74 payload bits hold a sequence,
 * node prefix, and random tail, in that order around the UUID version and variant.
 * Sequence width defaults to 12 bits. Node width defaults to the supplied byte
 * length capped at 62 bits; explicit widths may use any remaining payload bits.
 * Longer node inputs are truncated to their leading bits, not hashed or allocated.
 * The caller must establish profile provenance, prevent overlapping node allocation,
 * and own exclusive crash-safe state. A zero-length random tail requires no random
 * source; fewer random bits reduce collision resistance when coordination fails.
 * These IDs are not secrets.
 * The type parameter is a compile-time brand, not a runtime subclass factory.
 */
class IdFlake<T extends Id = Id> implements IterableIterator<T> {
  protected readonly sequenceBits: number;
  protected readonly nodeBits: number;
  protected readonly randomBits: number;
  protected readonly nodePrefix: bigint;
  protected readonly maxSequence: bigint;
  protected readonly clock: () => number;
  protected readonly randomSource: (size: number) => Uint8Array;
  protected lastTimestamp?: number;
  protected seqCounter?: bigint;
  protected _lastId?: T;

  /** Configures the bit allocation, copied node prefix, clock, and optional restart state. */
  public constructor(
    options: {
      nodeId?: Uint8Array;
      sequenceBits?: number;
      nodeBits?: number;
      lastId?: Uint8Array;
      timeSource?: (lastTs?: number) => () => number;
      randomSource?: (size: number) => Uint8Array;
    } = {},
  ) {
    if ('workerId' in options) {
      throw new TypeError(
        'Use nodeId bytes and nodeBits for the flake profile',
      );
    }
    const {
      nodeId = new Uint8Array(),
      sequenceBits = defaultSequenceBits,
      nodeBits: configuredNodeBits,
      lastId,
      timeSource = utils.timeSource,
      randomSource = utils.randomBytes,
    } = options;
    if (!utils.isUint8Array(nodeId)) {
      throw new RangeError('Node ID must be a Uint8Array');
    }
    const nodeBits =
      configuredNodeBits ??
      Math.min(nodeId.byteLength * 8, defaultNodeBitsLimit);
    assertAllocation(sequenceBits, nodeBits);
    if (nodeBits > nodeId.byteLength * 8) {
      throw new RangeError(
        'Node ID does not contain the requested prefix bits',
      );
    }
    this.sequenceBits = sequenceBits;
    this.nodeBits = nodeBits;
    this.randomBits = payloadBits - sequenceBits - nodeBits;
    this.nodePrefix = readPrefix(nodeId, nodeBits);
    this.maxSequence = bitMask(sequenceBits);
    this.randomSource = randomSource;
    this.clock = timeSource();
    if (lastId != null) {
      const payload = readPayload(lastId);
      const lastNode = (payload >> BigInt(this.randomBits)) & bitMask(nodeBits);
      if (lastNode !== this.nodePrefix) {
        throw new RangeError(
          'Restart ID does not match the configured node prefix',
        );
      }
      this.lastTimestamp = extractTs(lastId);
      this.seqCounter = payload >> BigInt(payloadBits - sequenceBits);
    }
  }

  /** Returns a copy of the last ID generated by this instance, if any. */
  get lastId(): T {
    if (this._lastId == null) {
      throw new ReferenceError('lastId has not yet been generated');
    }
    return IdInternal.create<T>(this._lastId);
  }

  /** Generates the next per-instance monotonic UUIDv8 flake. */
  public get(): T {
    return this.next().value as T;
  }

  /** Generates an ID or throws before invalid input or exhaustion changes state. */
  public next(): IteratorResult<T, void> {
    const id = this.tryGet();
    if (id == null) {
      throw new RangeError(
        'UUIDv8 flake counter exhausted; wait for the clock to advance',
      );
    }
    return { value: id, done: false };
  }

  /**
   * Attempts generation, returning undefined only when the counter is exhausted.
   * Invalid clocks, invalid randomness, and collaborator failures still throw.
   * A failed attempt does not advance the saved generator state.
   */
  public tryGet(): T | undefined {
    const now = this.clock();
    if (!Number.isFinite(now) || now < 0 || now > maxTimestamp) {
      throw new RangeError('UUIDv8 timestamp is outside the 48-bit range');
    }
    const timestamp = Math.max(Math.floor(now), this.lastTimestamp ?? 0);
    const sameTimestamp =
      this.lastTimestamp != null && timestamp === this.lastTimestamp;
    if (sameTimestamp && this.seqCounter === this.maxSequence) {
      return;
    }
    const sequence = sameTimestamp ? this.seqCounter! + 1n : 0n;
    let randomValue = 0n;
    if (this.randomBits > 0) {
      const size = Math.ceil(this.randomBits / 8);
      const random = this.randomSource(size);
      if (!utils.isUint8Array(random) || random.byteLength !== size) {
        throw new RangeError(`Random source must return exactly ${size} bytes`);
      }
      randomValue = readPrefix(random, this.randomBits);
    }
    const payload =
      (sequence << BigInt(payloadBits - this.sequenceBits)) |
      (this.nodePrefix << BigInt(this.randomBits)) |
      randomValue;
    const id = IdInternal.create<T>(16);
    utils.writeUint48BE(id, timestamp);
    const high = Number(payload >> 62n);
    id[6] = 0x80 | (high >> 8);
    id[7] = high & 0xff;
    let low = payload & lowPayloadMask;
    for (let i = 15; i >= 9; i--) {
      id[i] = Number(low & 0xffn);
      low >>= 8n;
    }
    id[8] = 0x80 | Number(low);

    const savedId = IdInternal.create<T>(id);
    this.lastTimestamp = timestamp;
    this.seqCounter = sequence;
    this._lastId = savedId;
    return id;
  }

  /** Returns this generator as an unbounded synchronous iterator. */
  public [Symbol.iterator](): IterableIterator<T> {
    return this;
  }
}

export default IdFlake;

export { extractTs, extractSeq, extractNodeId };
