import type { Id } from './Id.js';
import * as utils from './utils.js';
import IdInternal from './Id.js';

/**
 * Generates 16-byte RFC 9562 UUIDv4 values.
 *
 * Use when a fresh, non-time-ordered ID is preferred and exposing creation time
 * is undesirable. For time-oriented byte ordering, use IdSortable instead;
 * for reproducible IDs from names, use IdDeterministic. UUIDs are identifiers,
 * not authentication secrets, even when generated with secure randomness.
 *
 * UUIDv4 bit layout, in network byte order:
 *
 *     0                   1                   2                   3
 *     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |                          random_a                             |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |           random_a            |  0100 |       random_b        |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |1 0|                       random_c                            |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |                          random_c                             |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *
 * The default source uses Web Crypto. An injected source must return at least
 * 16 bytes and is responsible for its own randomness guarantees. The version
 * and variant bits are written into the source array before its first 16 bytes
 * are copied into the returned ID.
 * The type parameter is a compile-time brand, not a runtime subclass factory.
 */
class IdRandom<T extends Id = Id> implements IterableIterator<T> {
  protected randomSource: (size: number) => Uint8Array;

  /** Configures the byte source used for each generated UUIDv4. */
  public constructor({
    randomSource = utils.randomBytes,
  }: {
    randomSource?: (size: number) => Uint8Array;
  } = {}) {
    this.randomSource = randomSource;
  }

  /** Generates and returns a new UUIDv4 ID. */
  public get(): T {
    return this.next().value as T;
  }

  /** Generates the next ID; source errors and short-source errors propagate. */
  public next(): IteratorResult<T, void> {
    const id = IdInternal.create<T>(16);
    const random = this.randomSource(16);
    if (random.length < 16) {
      throw new Error('Random bytes length must be >= 16');
    }
    // Preserve the existing random-source mutation contract.
    random[6] = (random[6] & 0x0f) | 0x40;
    random[8] = (random[8] & 0x3f) | 0x80;
    id.set(random.subarray(0, 16));
    return {
      value: id,
      done: false,
    };
  }

  /** Returns this generator as an unbounded synchronous iterator. */
  public [Symbol.iterator](): IterableIterator<T> {
    return this;
  }
}

export default IdRandom;
