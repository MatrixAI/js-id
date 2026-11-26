import { describe, expect, test } from 'vitest';
import { IdInternal, IdDeterministic, utils } from '#index.js';

describe('public compatibility vectors', () => {
  test('preserves bytes through UUID, multibase, binary string, and JSON', () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    const id = IdInternal.create(bytes);
    expect(id.toUUID()).toBe('00010203-0405-0607-0809-0a0b0c0d0e0f');
    expect(IdInternal.fromUUID(id.toUUID())?.equals(id)).toBe(true);
    expect(IdInternal.fromString(id.toString()).equals(id)).toBe(true);
    expect(
      IdInternal.fromJSON(JSON.parse(JSON.stringify(id)))?.equals(id),
    ).toBe(true);
    for (const format of [
      'base16',
      'base32hex',
      'base58btc',
      'base64',
    ] as const) {
      expect(IdInternal.fromMultibase(id.toMultibase(format))?.equals(id)).toBe(
        true,
      );
    }
  });

  test('preserves zero-copy Buffer conversion including byte offsets', () => {
    const buffer = Buffer.from([99, 1, 2, 3, 88]);
    const id = IdInternal.fromBuffer(buffer.subarray(1, 4));
    expect([...id]).toEqual([1, 2, 3]);
    buffer[2] = 7;
    expect(id[1]).toBe(7);
    const view = id.toBuffer();
    view[0] = 9;
    expect(buffer[1]).toBe(9);
  });

  test('preserves deterministic generation and malformed-input outcomes', () => {
    const generator = new IdDeterministic({ namespace: 'compatibility' });
    expect(generator.get('same').equals(generator.get('same'))).toBe(true);
    expect(generator.get('same').equals(generator.get('different'))).toBe(
      false,
    );
    expect(IdInternal.fromJSON(null)).toBeUndefined();
    expect(IdInternal.fromUUID('short')).toBeUndefined();
    expect(IdInternal.fromMultibase('!invalid')).toBeUndefined();
    expect(() => utils.toUUID(new Uint8Array(15))).toThrow(RangeError);
  });

  test('accepts canonical UUID syntax without restricting UUID bits', () => {
    for (const uuid of [
      '00000000-0000-0000-0000-000000000000',
      'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
      '01234567-89AB-cdef-0123-456789ABCDEF',
    ]) {
      expect(utils.fromUUID(uuid)?.toUUID()).toBe(uuid.toLowerCase());
      expect(IdInternal.fromUUID(uuid)?.toUUID()).toBe(uuid.toLowerCase());
    }
  });

  test('rejects non-hex UUIDs and noncanonical separator placement', () => {
    for (const uuid of [
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      '1g000000-0000-0000-0000-000000000000',
      '0000000000000000-0000-0000-00000000',
      '00000000000000000000000000000000',
      '00000000--0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-00000000000',
      '00000000-0000-0000-0000-0000000000000',
      ' 00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000000\n',
    ]) {
      expect(utils.fromUUID(uuid)).toBeUndefined();
      expect(IdInternal.fromUUID(uuid)).toBeUndefined();
    }
  });
});
