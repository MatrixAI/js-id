import type { Id } from '#index.js';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';
import { sleep, shuffle } from './utils.js';
import IdSortable, { extractTs, extractSeq, extractRand } from '#IdSortable.js';
import * as utils from '#utils.js';

describe('IdSortable', () => {
  test('ids are Uint8Array', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    expect(id).toBeInstanceOf(Uint8Array);
  });
  test('ids can be generated', () => {
    const idGen = new IdSortable();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be generated as opaque type', () => {
    // Can't really check that types are working besides building
    // This is more of an example
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const idGen = new IdSortable<OpaqueId>();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be encoded and decoded as binary strings', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    const encoded = id.toString();
    const id_ = utils.fromString(encoded);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with multibase', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    const encoded = utils.toMultibase(id, 'base58btc');
    const id_ = utils.fromMultibase(encoded);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with uuid', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    const uuid = utils.toUUID(id);
    const id_ = utils.fromUUID(uuid);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('maintains the last id generated', () => {
    const idGen = new IdSortable();
    idGen.get();
    idGen.get();
    const id = utils.toBuffer(idGen.get());
    const id_ = utils.toBuffer(idGen.lastId);
    expect(id.equals(id_)).toBe(true);
  });
  test('ids in bytes are lexically sortable', () => {
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idBuffers = [...utils.take(idGen, 100)];
      const idBuffersShuffled = idBuffers.slice();
      shuffle(idBuffersShuffled);
      // Comparison is done on the bytes in lexicographic order
      idBuffersShuffled.sort(Buffer.compare);
      expect(idBuffersShuffled).toStrictEqual(idBuffers);
      count--;
    }
  });
  test('ids in bytes are lexically sortable with time delay', async () => {
    const id = new IdSortable();
    const i1 = utils.toBuffer(id.get());
    await sleep(250);
    const i2 = utils.toBuffer(id.get());
    await sleep(500);
    const i3 = utils.toBuffer(id.get());
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
  });
  test('encoded id strings are lexically sortable', () => {
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idStrings = [...utils.take(idGen, 100)].map((id) => id.toString());
      const idStringsShuffled = idStrings.slice();
      shuffle(idStringsShuffled);
      idStringsShuffled.sort();
      expect(idStringsShuffled).toStrictEqual(idStrings);
      count--;
    }
  });
  test('encoded uuids are lexically sortable', () => {
    // UUIDs are hex encoding, and the hex alphabet preserves order
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idUUIDs = [...utils.take(idGen, 100)].map(utils.toUUID);
      const idUUIDsShuffled = idUUIDs.slice();
      shuffle(idUUIDsShuffled);
      idUUIDsShuffled.sort();
      expect(idUUIDsShuffled).toStrictEqual(idUUIDs);
      count--;
    }
  });
  test('encoded multibase strings may be lexically sortable (base32hex)', () => {
    // `base32hex` preserves sort order
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idStrings = [...utils.take(idGen, 100)].map((id) =>
        utils.toMultibase(id, 'base32hex'),
      );
      const idStringsShuffled = idStrings.slice();
      shuffle(idStringsShuffled);
      idStringsShuffled.sort();
      expect(idStringsShuffled).toStrictEqual(idStrings);
      count--;
    }
  });
  test('encoded multibase strings may not be lexically sortable (base64)', async () => {
    // `base64` and `base58btc` does not preserve sort order
    const idGen = new IdSortable();
    const idStrings = [...utils.take(idGen, 100)].map((id) =>
      utils.toMultibase(id, 'base64'),
    );
    const idStringsShuffled = idStrings.slice();
    shuffle(idStringsShuffled);
    idStringsShuffled.sort();
    // It will not equal
    expect(idStringsShuffled).not.toStrictEqual(idStrings);
  });
  test('ids are monotonic within the same timestamp', () => {
    // To ensure that we it generates monotonic ids
    // we have to override the timesource
    const id = new IdSortable({
      timeSource: () => {
        return () => 0;
      },
      randomSource: (size) => new Uint8Array(size),
    });
    const i1 = utils.toBuffer(id.get());
    const i2 = utils.toBuffer(id.get());
    const i3 = utils.toBuffer(id.get());
    // They should not equal
    expect(i1.equals(i2)).toBe(false);
    expect(i2.equals(i3)).toBe(false);
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
    expect(extractTs(i1)).toBe(0);
    expect(extractTs(i2)).toBe(0);
    expect(extractTs(i3)).toBe(0);
    expect(extractSeq(i1)).toBe(0);
    expect(extractSeq(i2)).toBe(1);
    expect(extractSeq(i3)).toBe(2);
  });
  test('ids are monotonic over process restarts', () => {
    const id = new IdSortable({
      timeSource: () => () => 100000,
      randomSource: (size) => new Uint8Array(size),
    });
    const lastId = utils.toBuffer(id.get());
    const id_ = new IdSortable({
      lastId,
      timeSource: () => () => 0,
      randomSource: (size) => new Uint8Array(size),
    });
    const currId = utils.toBuffer(id_.get());
    expect(lastId.equals(currId)).toBe(false);
    const buffers = [currId, lastId];
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([lastId, currId]);
    expect(extractSeq(lastId)).toBe(0);
    expect(extractSeq(currId)).toBe(1);
  });
  test('encodes the RFC UUIDv7 timestamp and random fields', () => {
    const id = new IdSortable({
      timeSource: () => () => 1645557742000,
      randomSource: () =>
        Uint8Array.of(
          0x01,
          0x23,
          0x98,
          0xc4,
          0xdc,
          0x0c,
          0x0c,
          0x07,
          0x39,
          0x8f,
        ),
    }).get();
    expect(id.toUUID()).toBe('017f22e2-79b0-7123-98c4-dc0c0c07398f');
    expect(extractTs(id)).toBe(1645557742000);
    expect(extractSeq(id)).toBe(0x123);
    expect(extractRand(id)).toHaveLength(62);
  });
  test('can reproduce the RFC 9562 Appendix A.6 UUIDv7 vector', () => {
    const lastId = utils.fromUUID('017f22e2-79b0-7cc2-8000-000000000000')!;
    const generator = new IdSortable({
      lastId,
      timeSource: () => () => 1645557742000,
      randomSource: () =>
        Uint8Array.of(0, 0, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39, 0x8f),
    });
    const id = generator.get();
    expect(id.toUUID()).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
    expect(extractTs(id)).toBe(1645557742000);
    expect(extractSeq(id)).toBe(0xcc3);
  });
  test('throws on counter exhaustion and resumes when the clock advances', () => {
    let now = 1000;
    const id = new IdSortable({
      timeSource: () => () => now,
      randomSource: (size) => new Uint8Array(size),
    });
    let previous = id.get();
    for (let i = 1; i <= 4095; i++) {
      const next = id.get();
      expect(previous < next).toBe(true);
      previous = next;
    }
    expect(() => id.get()).toThrow(RangeError);
    expect(() => id.get()).toThrow('UUIDv7 counter exhausted');
    expect(id.lastId.equals(previous)).toBe(true);
    now++;
    expect(previous < id.get()).toBe(true);
  });
  test('rejects exhausted restart state until the clock advances', () => {
    const lastId = utils.fromUUID('00000000-03e8-7fff-8000-000000000000')!;
    let now = 999;
    const generator = new IdSortable({
      lastId,
      timeSource: () => () => now,
      randomSource: (size) => new Uint8Array(size),
    });
    expect(() => generator.get()).toThrow(RangeError);
    now = 1000;
    expect(() => generator.get()).toThrow(RangeError);
    now = 1001;
    const resumed = generator.get();
    expect(lastId < resumed).toBe(true);
    expect(extractTs(resumed)).toBe(1001);
    expect(extractSeq(resumed)).toBe(0);
  });
  test('reports exhaustion without throwing and propagates unrelated failures', () => {
    const lastId = utils.fromUUID('00000000-03e8-7fff-8000-000000000000')!;
    let now = 999;
    let calls = 0;
    let invalidRandom = false;
    let randomFailure = false;
    const generator = new IdSortable({
      lastId,
      timeSource: () => () => now,
      randomSource: (size) => {
        calls++;
        if (randomFailure) throw new Error('random failure');
        return new Uint8Array(invalidRandom ? size - 1 : size);
      },
    });
    expect(generator.tryGet()).toBeUndefined();
    expect(generator.tryGet()).toBeUndefined();
    expect(calls).toBe(0);
    expect(() => generator.lastId).toThrow(ReferenceError);
    now = 1000;
    expect(generator.tryGet()).toBeUndefined();
    now = NaN;
    expect(() => generator.tryGet()).toThrow(RangeError);
    now = 1001;
    invalidRandom = true;
    expect(() => generator.tryGet()).toThrow(RangeError);
    invalidRandom = false;
    randomFailure = true;
    expect(() => generator.tryGet()).toThrow('random failure');
    randomFailure = false;
    const resumed = generator.tryGet()!;
    expect(lastId < resumed).toBe(true);
    expect(extractTs(resumed)).toBe(1001);
    expect(extractSeq(resumed)).toBe(0);
    expect(generator.lastId.equals(resumed)).toBe(true);
  });
  test('accepts random byte arrays from another realm but rejects other views', () => {
    const foreignBytes = runInNewContext('new Uint8Array(10)') as Uint8Array;
    expect(foreignBytes).not.toBeInstanceOf(Uint8Array);
    const generator = new IdSortable({
      timeSource: () => () => 0,
      randomSource: () => foreignBytes,
    });
    expect(generator.get().toUUID()).toBe(
      '00000000-0000-7000-8000-000000000000',
    );
    const signed = new Int8Array(10);
    Object.defineProperty(signed, Symbol.toStringTag, { value: 'Uint8Array' });
    const invalid = new IdSortable({
      timeSource: () => () => 0,
      randomSource: () => signed as unknown as Uint8Array,
    });
    expect(() => invalid.get()).toThrow(RangeError);
  });
  test('clamps clock rollback and protects state from mutable returned bytes', () => {
    let now = 1000;
    const generator = new IdSortable({
      timeSource: () => () => now,
      randomSource: (size) => new Uint8Array(size),
    });
    const first = generator.get();
    const saved = generator.lastId;
    first.fill(255);
    saved.fill(255);
    now = 999;
    const second = generator.get();
    expect(extractTs(second)).toBe(1000);
    expect(extractSeq(second)).toBe(1);
    expect(generator.lastId.equals(second)).toBe(true);
  });
  test('copies restart state before the caller can mutate it', () => {
    const first = new IdSortable({
      timeSource: () => () => 1000,
      randomSource: (size) => new Uint8Array(size),
    }).get();
    const generator = new IdSortable({
      lastId: first,
      timeSource: () => () => 0,
      randomSource: (size) => new Uint8Array(size),
    });
    first.fill(255);
    const resumed = generator.get();
    expect(extractTs(resumed)).toBe(1000);
    expect(extractSeq(resumed)).toBe(1);
  });
  test('randomizes the counter seed while leaving its guard bit clear', () => {
    const generator = new IdSortable({
      timeSource: () => () => 1,
      randomSource: (size) => new Uint8Array(size).fill(255),
    });
    const first = generator.get();
    const second = generator.get();
    expect(extractSeq(first)).toBe(2047);
    expect(extractSeq(second)).toBe(2048);
  });
  test('leaves state unchanged when a random source fails', () => {
    let fail = false;
    const generator = new IdSortable({
      timeSource: () => () => 1,
      randomSource: (size) => {
        if (fail) throw new Error('random source failed');
        return new Uint8Array(size);
      },
    });
    const first = generator.get();
    fail = true;
    expect(() => generator.get()).toThrow('random source failed');
    expect(generator.lastId.equals(first)).toBe(true);
    fail = false;
    expect(extractSeq(generator.get())).toBe(1);
  });
  test('rejects invalid timestamps, restart IDs, and random sources', () => {
    for (const now of [-1, Infinity, NaN, 2 ** 48]) {
      const generator = new IdSortable({ timeSource: () => () => now });
      expect(() => generator.get()).toThrow(RangeError);
    }
    expect(() => new IdSortable({ lastId: new Uint8Array(16) })).toThrow(
      RangeError,
    );
    const generator = new IdSortable({
      timeSource: () => () => 0,
      randomSource: () => new Uint8Array(9),
    });
    expect(() => generator.get()).toThrow(RangeError);
    expect(() => generator.lastId).toThrow(ReferenceError);
    expect(() =>
      Reflect.construct(IdSortable, [{ nodeId: new Uint8Array(8) }]),
    ).toThrow(TypeError);
  });
  test('ids can be used as record indexes', () => {
    const idGen = new IdSortable();
    const ids = [...utils.take(idGen, 10)];
    let counter = 0;
    const record = {};
    for (const id of ids) {
      record[id] = counter;
      expect(record[id]).toBe(counter);
      counter++;
    }
  });
  test('ids can use comparison operators', () => {
    const idGen = new IdSortable();
    let idToCompare = idGen.get();
    const ids = [...utils.take(idGen, 100)];
    for (const id of ids) {
      expect(idToCompare < id).toBe(true);
      expect(idToCompare <= id).toBe(true);
      expect(idToCompare > id).toBe(false);
      expect(idToCompare >= id).toBe(false);
      idToCompare = id;
    }
  });
  test('ids in strings can be compared for equality', () => {
    const idGen = new IdSortable();
    const id1 = idGen.get();
    const id2 = idGen.get();
    // Objects will be different
    expect(id1 == id2).toBe(false); // eslint-disable-line eqeqeq
    // Sortable ids are different
    expect(id1.toString() == id2.toString()).toBe(false); // eslint-disable-line eqeqeq
    expect(id1.toString()).toBe(id1 + '');
    expect(id2.toString()).toBe(String(id2));
  });
});
