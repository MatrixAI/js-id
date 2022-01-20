import type { Id } from '@/Id';

import IdInternal from '@/Id';
import * as utils from '@/utils';

describe('Id', () => {
  test('create id from buffer', () => {
    const buffer = Buffer.from('abcefg');
    const id = IdInternal.create(buffer);
    expect(id.toString()).toBe('abcefg');
    expect(id + '').toBe('abcefg');
    // Primitive value of Id is still Uint8Array
    expect([...id.valueOf()]).toStrictEqual([...buffer]);
  });
  test('create id from id', () => {
    const buffer = Buffer.allocUnsafe(32);
    const id1 = IdInternal.create(buffer);
    const id2 = IdInternal.create(id1);
    expect([...id2]).toStrictEqual([...id1]);
  });
  test('id can be used as POJO keys', () => {
    const buffer = Buffer.from('hello world');
    const id = IdInternal.create(buffer);
    // Automatic string conversion takes place here
    // However the strings may not look very pretty
    // They are the raw binary string form
    // So if you expect to read this string on the terminal
    // Prefer to use an encoded form instead
    const pojo = {
      [id]: 'foo bar',
    };
    expect(pojo[id]).toBe('foo bar');
    expect(pojo[id.toString()]).toBe('foo bar');
    for (const k of Object.keys(pojo)) {
      const idDecoded = utils.fromString(k);
      expect(idDecoded).toBeDefined();
      expect([...idDecoded!]).toStrictEqual([...id]);
      break;
    }
  });
  test('id can be used as Map keys', () => {
    const buffer = Buffer.from('hello world');
    const id = IdInternal.create(buffer);
    // The id is an object, so this is an object key
    const map = new Map();
    map.set(id, 'foo bar');
    expect(map.get(id)).toBe('foo bar');
    expect(map.get(id.toString())).toBeUndefined();
  });

  test('id can be created as a opaque type directly', async () => {
    // Can't really check that types are working besides building
    // This is more of an example
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const buffer = Buffer.from('abcefg');

    const id1 = IdInternal.create<OpaqueId>(buffer);
    // Still functions as an Id.
    expect(id1.toString()).toBe('abcefg');
    expect(id1 + '').toBe('abcefg');
    expect([...id1.valueOf()]).toStrictEqual([...buffer]);

    const id2: OpaqueId = IdInternal.create(buffer);
    // Still functions as an Id.
    expect(id2.toString()).toBe('abcefg');
    expect(id2 + '').toBe('abcefg');
    expect([...id2.valueOf()]).toStrictEqual([...buffer]);
  });
  test('id can be converted to other types and back', async () => {
    // Can't really check that types are working besides building
    // This is more of an example
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const buffer = Buffer.from('0123456789ABCDEF');
    const id1 = IdInternal.create<OpaqueId>(buffer);

    const test1 = id1.toMultibase('base32hex');
    expect(IdInternal.fromMultibase<OpaqueId>(test1)).toStrictEqual(id1);
    const test2 = id1.toString();
    expect(IdInternal.fromString<OpaqueId>(test2)).toStrictEqual(id1);
    const test3 = id1.toUUID();
    expect(IdInternal.fromUUID<OpaqueId>(test3)).toStrictEqual(id1);
    const test4 = id1.toBuffer();
    expect(IdInternal.fromBuffer<OpaqueId>(test4)).toStrictEqual(id1);
  });
});
