import type { Id } from '#index.js';
import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import IdDeterministic from '#IdDeterministic.js';
import { _SHA256 } from '#noble-hashes/sha2.js';
import * as utils from '#utils.js';

describe('IdDeterministic', () => {
  test('CASE-ID-NAME-HASH: SHA-256 matches standard empty, short, multi-block, and million-byte vectors', () => {
    const encoder = new TextEncoder();
    const vectors = [
      ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
      [
        'abc',
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      ],
      [
        'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
        '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
      ],
      [
        'a'.repeat(1_000_000),
        'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
      ],
    ];
    for (const [message, expected] of vectors) {
      const actual = new _SHA256().update(encoder.encode(message)).digest();
      expect(Buffer.from(actual).toString('hex')).toBe(expected);
    }
  });
  test('CASE-ID-NAME-HASH: SHA-256 streaming agrees with Node across padding and block boundaries', () => {
    for (const length of [
      0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 4097,
    ]) {
      const backing = Uint8Array.from(
        { length: length + 7 },
        (_, i) => (i * 71) & 255,
      );
      const input = backing.subarray(3, 3 + length);
      const expected = createHash('sha256').update(input).digest('hex');
      for (const chunkSize of [1, 7, 64, 100]) {
        const hash = new _SHA256();
        for (let offset = 0; offset < input.length; offset += chunkSize) {
          hash.update(input.subarray(offset, offset + chunkSize));
        }
        expect(Buffer.from(hash.digest()).toString('hex')).toBe(expected);
      }
    }
  });
  test('CASE-ID-NAME-VECTOR: matches the RFC 9562 Appendix B.2 SHA-256 UUIDv8 vector', () => {
    const namespace = utils.fromUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')!;
    const generator = new IdDeterministic({ namespace });
    expect(generator.get('www.example.com').toUUID()).toBe(
      '5c146b14-3c52-8afd-938a-375d0df1fbf6',
    );
  });
  test('CASE-ID-NAME-HASH: matches independent SHA-256 results over varied UTF-8 input lengths', () => {
    const namespace = Uint8Array.from({ length: 16 }, (_, index) => index);
    const generator = new IdDeterministic({ namespace });
    for (const length of [
      0, 1, 37, 38, 39, 40, 45, 46, 47, 48, 55, 56, 63, 64, 65, 128, 1024,
      100_000,
    ]) {
      const name = 'x'.repeat(length) + '\u00e9';
      const digest = createHash('sha256')
        .update(namespace)
        .update(name, 'utf8')
        .digest();
      const expected = Uint8Array.from(digest.subarray(0, 16));
      expected[6] = (expected[6] & 0x0f) | 0x80;
      expected[8] = (expected[8] & 0x3f) | 0x80;
      expect([...generator.get(name)], name).toEqual([...expected]);
    }
  });
  test('CASE-ID-NAME-UNICODE: copies byte namespaces and does not normalize strings', () => {
    const namespace = new Uint8Array(16);
    const generator = new IdDeterministic({ namespace });
    const first = generator.get('name');
    namespace[0] = 1;
    expect(generator.get('name').equals(first)).toBe(true);
    expect(generator.get('\u00e9').equals(generator.get('e\u0301'))).toBe(
      false,
    );
    expect(generator.get('\ud800').equals(generator.get('\ufffd'))).toBe(true);
    expect(
      () => new IdDeterministic({ namespace: new Uint8Array(15) }),
    ).toThrow(RangeError);
  });
  test('ids are Uint8Array', () => {
    const idGen = new IdDeterministic();
    const id = idGen.get();
    expect(id).toBeInstanceOf(Uint8Array);
  });
  test('ids can be generated', () => {
    const idGen = new IdDeterministic();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be generated as a opaque type', () => {
    // Can't really check that types are working besides building
    // This is more of an example
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const idGen = new IdDeterministic<OpaqueId>();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be encoded and decoded as binary strings', () => {
    const idGen = new IdDeterministic();
    const id = idGen.get();
    const encoded = id.toString();
    const id_ = utils.fromString(encoded);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with multibase', () => {
    const idGen = new IdDeterministic();
    const id = idGen.get();
    const encoded = utils.toMultibase(id, 'base58btc');
    const id_ = utils.fromMultibase(encoded);
    expect(id_).toBeDefined();
    expect(Buffer.from(id).equals(Buffer.from(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with uuid', () => {
    const idGen = new IdDeterministic();
    const id = idGen.get();
    const uuid = utils.toUUID(id);
    const id_ = utils.fromUUID(uuid);
    expect(id_).toBeDefined();
    expect(Buffer.from(id).equals(Buffer.from(id_!))).toBe(true);
  });
  test('ids are deterministic', () => {
    const id = new IdDeterministic();
    const id1 = Buffer.from(id.get());
    const id2 = Buffer.from(id.get());
    expect(id1.equals(id2)).toBe(true);
    const id_ = new IdDeterministic({
      namespace: 'abc',
    });
    const id1_ = Buffer.from(id_.get());
    const id2_ = Buffer.from(id_.get());
    expect(id1_.equals(id2_)).toBe(true);
    expect(id1_.equals(id1)).toBe(false);
    const id3_ = Buffer.from(id_.get('foo'));
    const id4_ = Buffer.from(id_.get('bar'));
    expect(id3_.equals(id4_)).toBe(false);
  });
  test('ids with different namespaces will generate different ids', () => {
    const idGen1 = new IdDeterministic({
      namespace: 'foo',
    });
    const idGen2 = new IdDeterministic({
      namespace: 'bar',
    });
    const idA1 = Buffer.from(idGen1.get('a'));
    const idA2 = Buffer.from(idGen2.get('a'));
    expect(idA1.equals(idA2)).toBe(false);
    const idB1 = Buffer.from(idGen1.get('b'));
    const idB2 = Buffer.from(idGen2.get('b'));
    expect(idB1.equals(idB2)).toBe(false);
  });
  test('ids with the same namespace will generate the same ids', () => {
    const idGen1 = new IdDeterministic({
      namespace: 'abc',
    });
    const idGen2 = new IdDeterministic({
      namespace: 'abc',
    });
    const idA1 = Buffer.from(idGen1.get('a'));
    const idA2 = Buffer.from(idGen2.get('a'));
    expect(idA1.equals(idA2)).toBe(true);
    const idB1 = Buffer.from(idGen1.get('b'));
    const idB2 = Buffer.from(idGen2.get('b'));
    expect(idB1.equals(idB2)).toBe(true);
  });
  test('ids can be used as record indexes', () => {
    const idGen = new IdDeterministic({ namespace: 'foo' });
    const ids = [
      idGen.get('a'),
      idGen.get('b'),
      idGen.get('c'),
      idGen.get('d'),
    ];
    let counter = 0;
    const record = {};
    for (const id of ids) {
      record[id] = counter;
      expect(record[id]).toBe(counter);
      counter++;
    }
  });
  test('ids in strings can be compared for equality', () => {
    const idGen = new IdDeterministic({ namespace: 'foo' });
    const id1 = idGen.get('a');
    const id2 = idGen.get('a');
    // Objects will be different
    expect(id1 == id2).toBe(false); // eslint-disable-line eqeqeq
    // Deterministic ids are the same
    expect(id1.toString() == id2.toString()).toBe(true); // eslint-disable-line eqeqeq
    expect(id1.toString()).toBe(id2 + '');
    expect(id2.toString()).toBe(String(id1));
  });
});
