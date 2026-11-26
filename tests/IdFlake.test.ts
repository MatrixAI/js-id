import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';
import IdFlake, { extractNodeId, extractSeq, extractTs } from '#IdFlake.js';
import * as utils from '#utils.js';

function referenceId(timestamp: number, payload: string): Uint8Array {
  if (payload.length !== 74) throw new Error('Expected 74 payload bits');
  return utils.bits2bytes(
    timestamp.toString(2).padStart(48, '0') +
      '1000' +
      payload.slice(0, 12) +
      '10' +
      payload.slice(12),
  );
}

describe('IdFlake', () => {
  test('CASE-ID-FLAKE-LAYOUT: encodes a configurable 42-bit sequence and 32-bit node layout', () => {
    const nodeId = Uint8Array.of(0x12, 0x34, 0x56, 0x78);
    const generator = new IdFlake({
      nodeId,
      sequenceBits: 42,
      timeSource: () => () => 1645557742000,
      randomSource: () => {
        throw new Error('No random tail is configured');
      },
    });
    const first = generator.get();
    const second = generator.get();
    expect(first.toUUID()).toBe('017f22e2-79b0-8000-8000-000012345678');
    expect(extractTs(first)).toBe(1645557742000);
    expect(extractSeq(first, 42)).toBe(0n);
    expect(extractSeq(second, 42)).toBe(1n);
    expect(extractNodeId(first, { sequenceBits: 42, nodeBits: 32 })).toEqual(
      nodeId,
    );
    expect(first < second).toBe(true);
  });

  test('CASE-ID-FLAKE-LAYOUT: preserves the leading 62 node bits by default and copies input', () => {
    const nodeId = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 0xff, 0xaa);
    const expected = utils.bytes2bits(nodeId).slice(0, 62);
    const generator = new IdFlake({ nodeId, timeSource: () => () => 42 });
    nodeId.fill(0);
    const id = generator.get();
    const extracted = extractNodeId(id, { sequenceBits: 12, nodeBits: 62 });
    expect(utils.bytes2bits(extracted).slice(0, 62)).toBe(expected);
    expect(extracted[7] & 3).toBe(0);
  });

  test('CASE-ID-FLAKE-LAYOUT: packs every sequence width against an independent bit-string model', () => {
    const node = Uint8Array.of(
      0xaa,
      0x55,
      0x96,
      0xe1,
      0x22,
      0x43,
      0x87,
      0x69,
      0x42,
      0xd0,
    );
    for (let sequenceBits = 1; sequenceBits <= 74; sequenceBits++) {
      const remaining = 74 - sequenceBits;
      for (const nodeBits of new Set([
        0,
        Math.floor(remaining / 2),
        remaining,
      ])) {
        const randomBits = remaining - nodeBits;
        const generator = new IdFlake({
          sequenceBits,
          nodeBits,
          nodeId: node,
          timeSource: () => () => 1234,
          randomSource: (size) => new Uint8Array(size).fill(0xa5),
        });
        const first = generator.get();
        const payload =
          '0'.repeat(sequenceBits) +
          utils.bytes2bits(node).slice(0, nodeBits) +
          '10100101'.repeat(Math.ceil(randomBits / 8)).slice(0, randomBits);
        expect(first.equals(referenceId(1234, payload))).toBe(true);
        expect(extractSeq(first, sequenceBits)).toBe(0n);
        expect(
          utils
            .bytes2bits(extractNodeId(first, { sequenceBits, nodeBits }))
            .slice(0, nodeBits),
        ).toBe(utils.bytes2bits(node).slice(0, nodeBits));
        const next = generator.get();
        expect(extractSeq(next, sequenceBits)).toBe(1n);
        expect(first < next).toBe(true);
      }
    }
  });

  test('CASE-ID-FLAKE-LAYOUT: allocates random bits after the node and masks unused source bits', () => {
    const requests: number[] = [];
    const generator = new IdFlake({
      sequenceBits: 12,
      nodeId: Uint8Array.of(0x12, 0x34, 0x56, 0x78),
      timeSource: () => () => 10,
      randomSource: (size) => {
        requests.push(size);
        return new Uint8Array(size).fill(0xff);
      },
    });
    const id = generator.get();
    expect(requests).toEqual([4]);
    expect(
      id.equals(
        referenceId(
          10,
          '0'.repeat(12) +
            utils.bytes2bits(Uint8Array.of(0x12, 0x34, 0x56, 0x78)) +
            '1'.repeat(30),
        ),
      ),
    ).toBe(true);
  });

  test('CASE-ID-FLAKE-NODES: separates different equal-width nodes for the same timestamp and sequence', () => {
    const options = {
      sequenceBits: 12,
      timeSource: () => () => 50,
      randomSource: (size: number) => new Uint8Array(size),
    };
    const lower = new IdFlake({ ...options, nodeId: Uint8Array.of(1) }).get();
    const upper = new IdFlake({ ...options, nodeId: Uint8Array.of(2) }).get();
    expect(lower.equals(upper)).toBe(false);
    expect(lower < upper).toBe(true);
  });

  test('CASE-ID-VALUE-STATE CASE-ID-FLAKE-CLOCK: holds time during rollback and resumes from copied restart state', () => {
    let now = 1000;
    const nodeId = Uint8Array.of(0xab);
    const generator = new IdFlake({ nodeId, timeSource: () => () => now });
    const first = generator.get();
    const saved = generator.lastId;
    const resumed = new IdFlake({
      nodeId,
      lastId: saved,
      timeSource: () => () => 0,
    });
    first.fill(255);
    saved.fill(255);
    now = 999;
    expect(extractTs(generator.get())).toBe(1000);
    const next = resumed.get();
    expect(extractTs(next)).toBe(1000);
    expect(extractSeq(next)).toBe(1n);
  });

  test('CASE-ID-FLAKE-EXHAUST: rejects exhausted sequences including a 74-bit restart and recovers', () => {
    for (const sequenceBits of [1, 12, 42, 53, 54, 74]) {
      const lastId = referenceId(
        1000,
        '1'.repeat(sequenceBits) + '0'.repeat(74 - sequenceBits),
      );
      let now = 1000;
      const generator = new IdFlake({
        sequenceBits,
        lastId,
        timeSource: () => () => now,
        randomSource: (size) => new Uint8Array(size),
      });
      expect(extractSeq(lastId, sequenceBits)).toBe(
        (1n << BigInt(sequenceBits)) - 1n,
      );
      expect(generator.tryGet()).toBeUndefined();
      expect(() => generator.lastId).toThrow(ReferenceError);
      expect(() => generator.get()).toThrow(RangeError);
      now = 999;
      expect(generator.tryGet()).toBeUndefined();
      expect(() => generator.get()).toThrow('counter exhausted');
      now = 1001;
      expect(extractSeq(generator.tryGet()!, sequenceBits)).toBe(0n);
    }
  });

  test('CASE-ID-FLAKE-EXHAUST: reports flake exhaustion without hiding clock or random failures', () => {
    let now = 1000;
    let invalidRandom = false;
    let randomFailure = false;
    let calls = 0;
    const generator = new IdFlake({
      sequenceBits: 1,
      timeSource: () => () => now,
      randomSource: (size) => {
        calls++;
        if (randomFailure) throw new Error('random failure');
        return new Uint8Array(invalidRandom ? size - 1 : size);
      },
    });
    const first = generator.tryGet()!;
    const last = generator.tryGet()!;
    expect(first < last).toBe(true);
    expect(generator.tryGet()).toBeUndefined();
    expect(generator.tryGet()).toBeUndefined();
    expect(calls).toBe(2);
    expect(generator.lastId.equals(last)).toBe(true);
    now = Infinity;
    expect(() => generator.tryGet()).toThrow(RangeError);
    now = 1001;
    invalidRandom = true;
    expect(() => generator.tryGet()).toThrow(RangeError);
    expect(generator.lastId.equals(last)).toBe(true);
    invalidRandom = false;
    randomFailure = true;
    expect(() => generator.tryGet()).toThrow('random failure');
    expect(generator.lastId.equals(last)).toBe(true);
    randomFailure = false;
    const resumed = generator.tryGet()!;
    expect(last < resumed).toBe(true);
    expect(extractSeq(resumed, 1)).toBe(0n);
  });

  test('CASE-ID-FLAKE-FAILURE: leaves committed state unchanged when random generation fails', () => {
    let fail = false;
    const generator = new IdFlake({
      nodeId: Uint8Array.of(1),
      timeSource: () => () => 1,
      randomSource: (size) => {
        if (fail) throw new Error('random failure');
        return new Uint8Array(size);
      },
    });
    const first = generator.get();
    fail = true;
    expect(() => generator.get()).toThrow('random failure');
    expect(generator.lastId.equals(first)).toBe(true);
    fail = false;
    expect(extractSeq(generator.get())).toBe(1n);
  });

  test('CASE-ID-FLAKE-FAILURE: leaves committed state unchanged when the random result has the wrong size', () => {
    let invalid = false;
    const generator = new IdFlake({
      timeSource: () => () => 1,
      randomSource: (size) => new Uint8Array(invalid ? size + 1 : size),
    });
    const first = generator.get();
    invalid = true;
    expect(() => generator.get()).toThrow(RangeError);
    expect(generator.lastId.equals(first)).toBe(true);
    invalid = false;
    expect(extractSeq(generator.get())).toBe(1n);
  });

  test('CASE-ID-FLAKE-INVALID: rejects invalid allocation, node, timestamps, randomness, and restart state', () => {
    for (const sequenceBits of [0, 75, -1, 0.5, NaN, Infinity]) {
      expect(() => new IdFlake({ sequenceBits })).toThrow(RangeError);
    }
    for (const nodeBits of [-1, 0.5, NaN, Infinity, 63]) {
      expect(
        () => new IdFlake({ nodeBits, nodeId: new Uint8Array(8) }),
      ).toThrow(RangeError);
    }
    expect(
      () => new IdFlake({ nodeBits: 9, nodeId: new Uint8Array(1) }),
    ).toThrow(RangeError);
    expect(
      () => new IdFlake({ sequenceBits: 42, nodeId: new Uint8Array(8) }),
    ).toThrow(RangeError);
    expect(() => Reflect.construct(IdFlake, [{ workerId: 7 }])).toThrow(
      TypeError,
    );
    for (const now of [-1, NaN, Infinity, 2 ** 48]) {
      const generator = new IdFlake({ timeSource: () => () => now });
      expect(() => generator.get()).toThrow(RangeError);
    }
    expect(() => new IdFlake({ lastId: new Uint8Array(16) })).toThrow(
      RangeError,
    );
    const first = new IdFlake({ nodeId: Uint8Array.of(1) }).get();
    expect(
      () => new IdFlake({ nodeId: Uint8Array.of(2), lastId: first }),
    ).toThrow(RangeError);
    const invalid = new IdFlake({ randomSource: () => new Uint8Array(1) });
    expect(() => invalid.get()).toThrow(RangeError);
    expect(() => invalid.lastId).toThrow(ReferenceError);
  });

  test('accepts foreign-realm byte arrays and rejects other array views', () => {
    const foreign = runInNewContext(
      'new Uint8Array([1, 2, 3, 4])',
    ) as Uint8Array;
    const generator = new IdFlake({
      nodeId: foreign,
      timeSource: () => () => 0,
      randomSource: (size) =>
        runInNewContext(`new Uint8Array(${size})`) as Uint8Array,
    });
    expect(
      extractNodeId(generator.get(), { sequenceBits: 12, nodeBits: 32 }),
    ).toEqual(Uint8Array.of(1, 2, 3, 4));
    const bad = new IdFlake({
      randomSource: () => new Int8Array(8) as unknown as Uint8Array,
    });
    expect(() => bad.get()).toThrow(RangeError);
  });
});
