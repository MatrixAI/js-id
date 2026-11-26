import type { Id } from './Id.js';
import IdInternal from './Id.js';
import { sha256 } from './noble-hashes/sha2.js';

const textEncoder = new TextEncoder();
const nilNamespace = new Uint8Array(16);

/**
 * SHA-256 is vendored verbatim from noble-hashes 2.4.0, commit
 * 663c2aeeffc308ac0cded59bd32f7c212adacfc2, under the MIT license in
 * LICENSE.noble-hashes. TypeScript rewrites relative imports in emitted JS
 * without modifying the upstream source files.
 */
function nameUuidV8<T extends Id>(namespace: Uint8Array, name: string): T {
  const digest = sha256
    .create()
    .update(namespace)
    .update(textEncoder.encode(name))
    .digest();
  const id = IdInternal.create<T>(16);
  id.set(digest.subarray(0, 16));
  id[6] = (id[6] & 0x0f) | 0x80;
  id[8] = (id[8] & 0x3f) | 0x80;
  return id;
}

/**
 * Generates a SHA-256 name-based UUIDv8 profile synchronously.
 *
 * Use when the same namespace and name must reproducibly yield the same ID.
 * This is not a fresh random ID or a time-sortable generator: use IdRandom or
 * IdSortable for those purposes. Names that may change require an explicit
 * consuming-domain identity policy; predictable names can be guessed.
 *
 * SHA-256 UUIDv8 bit layout, in network byte order:
 *
 *     0                   1                   2                   3
 *     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |                        digest bits 0..31                      |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |       digest bits 32..47      |  1000 |  digest bits 52..63   |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |1 0|                    digest bits 66..95                     |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *    |                       digest bits 96..127                     |
 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *
 * The first 128 digest bits are used; version and variant replace six of them.
 *
 * Byte namespaces must contain exactly 16 bytes and are copied. String
 * namespaces are first derived using this profile and the nil UUID namespace.
 * Names and string namespaces use TextEncoder UTF-8 without normalization.
 * Outputs are identifiers, not secrets or password hashes. The type parameter
 * is a compile-time brand, not a runtime subclass factory.
 */
class IdDeterministic<T extends Id = Id> implements IterableIterator<T> {
  protected namespaceData: Uint8Array;

  /** Selects a string or 16-byte namespace, defaulting to the empty string. */
  public constructor({
    namespace = '',
  }: {
    namespace?: string | Uint8Array;
  } = {}) {
    if (typeof namespace === 'string') {
      this.namespaceData = nameUuidV8(nilNamespace, namespace);
    } else {
      if (namespace.byteLength !== 16) {
        throw new RangeError('Namespace must contain exactly 16 bytes');
      }
      this.namespaceData = Uint8Array.from(namespace);
    }
  }

  /** Returns the ID for the supplied name, or for the empty name if omitted. */
  public get(name?: string): T {
    return this.next(name).value as T;
  }

  /** Returns an iterator result containing the deterministic ID for the name. */
  public next(name: string = ''): IteratorResult<T, void> {
    const id = nameUuidV8<T>(this.namespaceData, name);
    return {
      value: id,
      done: false,
    };
  }

  /** Returns this unbounded iterator; ordinary iteration uses the empty name. */
  public [Symbol.iterator](): IterableIterator<T> {
    return this;
  }
}

export default IdDeterministic;
