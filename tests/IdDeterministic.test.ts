import type { Id } from '@';

import IdDeterministic from '@/IdDeterministic';
import * as utils from '@/utils';

describe('IdDeterministic', () => {
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
