import { randomUUID } from 'node:crypto';
import { describe, expect, test, vi } from 'vitest';
import { CID } from 'multiformats/cid';
import { bases } from 'multiformats/basics';
import { create as createDigest } from 'multiformats/hashes/digest';
import * as utils from '#utils.js';

describe('utils', () => {
  test('reads and writes unsigned 48-bit values in network order', () => {
    const bytes = new Uint8Array(10).fill(0xaa);
    utils.writeUint48BE(bytes, 0x0123456789ab, 2);
    expect([...bytes]).toEqual([
      0xaa, 0xaa, 1, 0x23, 0x45, 0x67, 0x89, 0xab, 0xaa, 0xaa,
    ]);
    expect(utils.readUint48BE(bytes, 2)).toBe(0x0123456789ab);
    utils.writeUint48BE(bytes, 2 ** 48 - 1);
    expect(utils.readUint48BE(bytes)).toBe(2 ** 48 - 1);
    for (const value of [-1, 0.5, NaN, Infinity, 2 ** 48]) {
      expect(() => utils.writeUint48BE(bytes, value)).toThrow(RangeError);
    }
    for (const offset of [-1, 0.5, 5, Infinity]) {
      expect(() => utils.readUint48BE(bytes, offset)).toThrow(RangeError);
      expect(() => utils.writeUint48BE(bytes, 0, offset)).toThrow(RangeError);
    }
  });

  test('checks UUID version and variant without assuming a profile', () => {
    const id = utils.fromUUID('00000000-0000-7000-8000-000000000000')!;
    expect(utils.isUuidVersion(id, 7)).toBe(true);
    expect(utils.isUuidVersion(id, 8)).toBe(false);
    id[8] = 0;
    expect(utils.isUuidVersion(id, 7)).toBe(false);
    expect(utils.isUuidVersion(new Uint8Array(15), 7)).toBe(false);
  });

  test('round trips large IDs through binary strings without argument overflow', () => {
    const bytes = new Uint8Array(262_145);
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 256;
    }
    const binary = utils.toString(bytes);
    expect(binary.length).toBe(bytes.length);
    expect(utils.fromString(binary).equals(bytes)).toBe(true);
  });

  test('uses Web Crypto for large random byte requests in bounded chunks', () => {
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    try {
      expect(utils.randomBytes(131_073)).toHaveLength(131_073);
      expect(spy.mock.calls.map(([bytes]) => bytes!.byteLength)).toEqual([
        65_536, 65_536, 1,
      ]);
      expect(() => utils.randomBytes(-1)).toThrow(RangeError);
      expect(() => utils.randomBytes(1.5)).toThrow(RangeError);
    } finally {
      spy.mockRestore();
    }
  });
  test('clamps a restart clock without adding its timestamp to the epoch', () => {
    vi.stubGlobal('performance', {
      timeOrigin: 0,
      now: () => 1_700_000_000_000,
    });
    try {
      expect(utils.timeSource()()).toBe(1_700_000_000_000);
      expect(utils.timeSource(1_700_000_000_001)()).toBe(1_700_000_000_001);
      expect(utils.timeSource(1_699_999_999_999)()).toBe(1_700_000_000_000);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  test('take from an iterator', () => {
    // Arrays are not iterators, but you can acquire the iterator
    expect([...utils.take([1, 2, 3, 4][Symbol.iterator](), 2)]).toStrictEqual([
      1, 2,
    ]);
  });
  test('encoding & decoding UUID', () => {
    const hex1 = '01858a9e0e5c73edbde194f017ebdb3b';
    const id1 = '01858a9e-0e5c-73ed-bde1-94f017ebdb3b';
    const bytes1 = utils.hex2bytes(hex1);
    const uuid1 = utils.toUUID(bytes1);
    expect(uuid1).toBe(id1);
    const id2 = randomUUID();
    expect(utils.toUUID(utils.fromUUID(id2)!)).toBe(id2);
    const bytes1_ = utils.fromUUID(uuid1);
    expect(Buffer.from(bytes1_!).equals(bytes1)).toBe(true);
    // Cannot convert to UUID if the byte length is not 16 bytes
    const hex3 = '01858a9e0e5c73edbde194f017ebdb3b0185';
    const bytes3 = utils.hex2bytes(hex3);
    expect(() => {
      utils.toUUID(bytes3);
    }).toThrow(RangeError);
    const hex4 = '0185';
    const bytes4 = utils.hex2bytes(hex4);
    expect(() => {
      utils.toUUID(bytes4);
    }).toThrow(RangeError);
  });
  test('encoding and decoding bytes and bit strings', () => {
    // 128 size bit string
    const bits =
      '00000110000101100010100100001100101001110100010001110000000000001011000111101000111001101100100010110010011110110110110100110011';
    const bytes = new Uint8Array([
      6, 22, 41, 12, 167, 68, 112, 0, 177, 232, 230, 200, 178, 123, 109, 51,
    ]);
    expect(utils.bits2bytes(bits)).toStrictEqual(bytes);
    expect(utils.bytes2bits(bytes)).toBe(bits);
    expect(utils.bytes2bits(utils.bits2bytes(bits))).toBe(bits);
    expect(utils.bits2bytes(utils.bytes2bits(bytes))).toStrictEqual(bytes);
  });
  test('encoding and decoding bytes and hex strings', () => {
    // Uuid hex
    const hex = '0616290ca7447000b1e8e6c8b27b6d33';
    const bytes = new Uint8Array([
      6, 22, 41, 12, 167, 68, 112, 0, 177, 232, 230, 200, 178, 123, 109, 51,
    ]);
    expect(utils.hex2bytes(hex)).toStrictEqual(bytes);
    expect(utils.bytes2hex(bytes)).toBe(hex);
    expect(utils.bytes2hex(utils.hex2bytes(hex))).toBe(hex);
    expect(utils.hex2bytes(utils.bytes2hex(bytes))).toStrictEqual(bytes);
  });
  test('encoding decimal to bit strings', () => {
    expect(utils.dec2bits(0, 8)).toBe('00000000');
    expect(utils.dec2bits(1, 8)).toBe('00000001');
    expect(utils.dec2bits(2, 8)).toBe('00000010');
    expect(utils.dec2bits(255, 8)).toBe('11111111');
    // This should roll back to the beginning
    expect(utils.dec2bits(256, 8)).toBe('00000000');
    expect(utils.dec2bits(257, 8)).toBe('00000001');
  });
  test('encoding decimal to hex strings', () => {
    expect(utils.dec2hex(0, 2)).toBe('00');
    expect(utils.dec2hex(1, 2)).toBe('01');
    expect(utils.dec2hex(2, 2)).toBe('02');
    expect(utils.dec2hex(10, 2)).toBe('0a');
    expect(utils.dec2hex(15, 2)).toBe('0f');
    expect(utils.dec2hex(255, 2)).toBe('ff');
    // This should roll back to the beginning
    expect(utils.dec2hex(256, 2)).toBe('00');
    expect(utils.dec2hex(257, 2)).toBe('01');
  });
  test('chunking strings', () => {
    const s1 = '111222333';
    const c1 = utils.strChunks(s1, 3);
    expect(c1).toStrictEqual(['111', '222', '333']);
    const s2 = '11122233';
    const c2 = utils.strChunks(s2, 3);
    expect(c2).toStrictEqual(['111', '222', '33']);
  });
  test('rounding to decimal precision', () => {
    expect(utils.roundPrecise(0.1234, 3)).toBe(0.123);
    expect(utils.roundPrecise(1.26, 1)).toBe(1.3);
    expect(utils.roundPrecise(1.31, 1)).toBe(1.3);
    expect(utils.roundPrecise(1.255, 2)).toBe(1.26);
    expect(utils.roundPrecise(1.5)).toBe(2);
    expect(utils.roundPrecise(1.49)).toBe(1);
  });
  test('fixed point conversion', () => {
    // To 3 decimal places
    // we should expect .102 to be the resulting fractional
    // eslint-disable-next-line no-loss-of-precision
    const fp1 = 1633860855.1015312;
    const fixed1 = utils.toFixedPoint(fp1, 12, 3);
    expect(fixed1[1]).toBe(417);
    const fp1_ = utils.fromFixedPoint(fixed1, 12, 3);
    expect(fp1_).toBe(utils.roundPrecise(fp1, 3));
    // Also to 3 decimal places
    // expecting 0.101 now
    // eslint-disable-next-line no-loss-of-precision
    const fp2 = 1633860855.1014312;
    const fixed2 = utils.toFixedPoint(fp2, 12, 3);
    expect(fixed2[1]).toBe(413);
    const fp2_ = utils.fromFixedPoint(fixed2, 12, 3);
    expect(fp2_).toBe(utils.roundPrecise(fp2, 3));
    // 0 edge case
    expect(utils.toFixedPoint(0, 12, 3)).toStrictEqual([0, 0]);
    expect(utils.fromFixedPoint([0, 0], 12, 3)).toBe(0.0);
  });
  test('fixed point conversion when close to 1', () => {
    // Highest number 12 digits can represent is 4095
    // a number of 4096 would result in overflow
    // here we test when we get close to 4096
    // the conversion from toFixedPoint and fromFixedPoint will be lossy
    // this is because toFixedPoint will round off precision and floor any number getting close to 4096
    let closeTo: number;
    let fp: [number, number];
    // Exactly at 3 decimal points
    closeTo = 0.999;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 4091]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0.999);
    // Will round below
    closeTo = 0.9994;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 4091]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0.999);
    // Will round above to 1
    closeTo = 0.9995;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([1, 0]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(1);
    // Will round above to 1
    closeTo = 0.9999;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([1, 0]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(1);
    // Will round above to 1
    closeTo = 0.99999;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([1, 0]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(1);
    // Exactly at 5 decimal points
    closeTo = 0.99999;
    fp = utils.toFixedPoint(closeTo, 12, 5);
    expect(fp).toStrictEqual([0, 4095]);
    expect(utils.fromFixedPoint(fp, 12, 5)).toBe(0.99976);
  });
  test('fixed point conversion when close to 0', () => {
    let closeTo: number;
    let fp: [number, number];
    // Exactly 3 decimal places
    closeTo = 0.001;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 4]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0.001);
    // Will round to 0
    closeTo = 0.0001;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 0]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0);
    // Will round to 0
    closeTo = 0.0004;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 0]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0);
    // Will round to 0.001
    closeTo = 0.0005;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 4]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0.001);
    // Will round to 0.001
    closeTo = 0.00055;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 4]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0.001);
    // Will round to 0.001
    closeTo = 0.0009;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 4]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0.001);
    // Will round to 0.002
    closeTo = 0.0015;
    fp = utils.toFixedPoint(closeTo, 12, 3);
    expect(fp).toStrictEqual([0, 8]);
    expect(utils.fromFixedPoint(fp, 12, 3)).toBe(0.002);
  });
  test('multibase encoding and decoding', () => {
    const bytes = new Uint8Array([
      123, 124, 125, 126, 127, 128, 129, 130, 123, 124, 125, 126, 127, 128, 129,
      130,
    ]);
    const encoded = utils.toMultibase(bytes, 'base58btc');
    expect(encoded).toBe('zGFRLUyEszBgw9bRXTeFvu7');
    const bytes_ = utils.fromMultibase(encoded);
    expect(bytes_).toBeDefined();
    expect(Buffer.from(bytes_!).equals(Buffer.from(bytes))).toBe(true);
    // Reject unrecognized prefixes and malformed encodings.
    expect(utils.fromMultibase('aAQ3')).toBeUndefined();
    expect(utils.fromMultibase('aAQ333333333333333AAAAAA')).toBeUndefined();
    expect(
      utils.fromMultibase('zF4VfF3uRhSqgxTOOLONGxTRdVKauV9'),
    ).toBeUndefined();
    expect(utils.fromMultibase('zFxTOOSHORTx9')).toBeUndefined();
    expect(utils.fromMultibase('helloworld')).toBeUndefined();
  });
  test('preserves all upstream multibase formats including emoji prefixes', () => {
    const bytes = new TextEncoder().encode('0123456789ABCDEF');
    for (const format of Object.keys(bases) as Array<utils.MultibaseFormats>) {
      const expected = bases[format].encode(bytes);
      expect(utils.toMultibase(bytes, format)).toBe(expected);
      expect([...utils.fromMultibase(expected)!], format).toEqual([...bytes]);
    }
  });
  test('transports CID bytes as multibase without interpreting CID structure', () => {
    // IPFS CID specification: CIDv1 for the raw bytes "hello".
    const text = 'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq';
    const cid = CID.parse(text);
    const id = utils.fromMultibase(text)!;
    expect([...id]).toEqual([...cid.bytes]);
    expect(CID.decode(id).equals(cid)).toBe(true);
    const base58 = utils.toMultibase(id, 'base58btc');
    expect(CID.parse(base58).equals(cid)).toBe(true);
    const cidV0 = CID.createV0(createDigest(0x12, cid.multihash.digest));
    expect(utils.fromMultibase(cidV0.toString())).toBeUndefined();
    const arbitrary = utils.fromMultibase(
      utils.toMultibase(Uint8Array.of(0), 'base32'),
    )!;
    expect([...arbitrary]).toEqual([0]);
    expect(() => CID.decode(arbitrary)).toThrow();
  });
  test('buffer encoding and decoding is zero copy', () => {
    const bytes = new Uint8Array([
      123, 124, 125, 126, 127, 128, 129, 130, 123, 124, 125, 126, 127, 128, 129,
      130,
    ]);
    const buffer = utils.toBuffer(bytes);
    buffer[0] = 122;
    expect(bytes[0]).toBe(122);
    const bytes_ = utils.fromBuffer(buffer);
    expect(bytes_).toBeDefined();
    bytes_![0] = 121;
    expect(bytes[0]).toBe(121);
    expect(buffer[0]).toBe(121);
  });
});

describe('sortable base64', () => {
  test('matches the Base64sort draft unpadded vectors', () => {
    // Draft-brown-davis-base64-sort-01, Appendix B.
    const vectors = [
      ['f', 'OV'],
      ['fo', 'Oaw'],
      ['foo', 'Oaxj'],
      ['foob', 'OaxjNV'],
      ['fooba', 'OaxjNa3'],
      ['foobar', 'OaxjNa4m'],
      ['test', 'S5KnS-'],
      ['Hello World', 'H5KgQ5wVKqxmQ5F'],
      ['-', 'AF'],
      ['0', 'B-'],
      ['_', 'Mk'],
      ['A', 'FF'],
      ['a', 'NF'],
      ['=', 'EF'],
      ['~', 'UV'],
    ];
    for (const [input, encoded] of vectors) {
      const bytes = new TextEncoder().encode(input);
      expect(utils.toSortableBase64(bytes)).toBe(encoded);
      expect([...utils.fromSortableBase64(encoded)!]).toEqual([...bytes]);
    }
    const tenDigits = new TextEncoder().encode('0123456789');
    for (const [padding, encoded] of [
      ['=', 'B23mBnFpCYRsDF=='],
      ['~', 'B23mBnFpCYRsDF~~'],
    ] as const) {
      expect(utils.toSortableBase64Padded(tenDigits, padding)).toBe(encoded);
      expect([...utils.fromSortableBase64(encoded)!]).toEqual([...tenDigits]);
    }
    expect([...utils.fromSortableBase64('OV==')!]).toEqual([0x66]);
    expect([...utils.fromSortableBase64('OV~~')!]).toEqual([0x66]);
  });

  test('encodes known unpadded bit patterns', () => {
    expect(utils.toSortableBase64(new Uint8Array())).toBe('');
    expect(utils.toSortableBase64(Uint8Array.of(0))).toBe('--');
    expect(utils.toSortableBase64(Uint8Array.of(0xff))).toBe('zk');
    expect(utils.toSortableBase64(Uint8Array.of(0, 0, 0))).toBe('----');
    expect(utils.toSortableBase64(Uint8Array.of(0xff, 0xff, 0xff))).toBe(
      'zzzz',
    );
    expect(utils.toSortableBase64(new Uint8Array(16))).toHaveLength(22);
  });

  test('round trips arbitrary byte lengths without sharing storage', () => {
    for (let length = 0; length <= 64; length++) {
      const input = Uint8Array.from(
        { length },
        (_, index) => (index * 97 + length * 13) & 0xff,
      );
      const encoded = utils.toSortableBase64(input);
      const decoded = utils.fromSortableBase64(encoded);
      expect(decoded).toBeDefined();
      expect([...decoded!]).toEqual([...input]);
      for (const padding of ['=', '~'] as const) {
        const padded = utils.toSortableBase64Padded(input, padding);
        expect(padded.length % 4).toBe(0);
        expect([...utils.fromSortableBase64(padded)!]).toEqual([...input]);
      }
      if (length > 0) {
        decoded![0] ^= 0xff;
        expect(decoded![0]).not.toBe(input[0]);
      }
    }
  });

  test('sorts equal-length values in unsigned byte order', () => {
    const values = Array.from({ length: 1024 }, (_, index) => {
      const bytes = new Uint8Array(16);
      bytes[14] = index >> 8;
      bytes[15] = index & 0xff;
      return bytes;
    });
    const encoded = values.map(utils.toSortableBase64);
    expect([...encoded].reverse().sort()).toEqual(encoded);
    for (const padding of ['=', '~'] as const) {
      const padded = values.map((value) =>
        utils.toSortableBase64Padded(value, padding),
      );
      expect([...padded].reverse().sort()).toEqual(padded);
    }
    const decoded = encoded.map((value) =>
      Buffer.from(utils.fromSortableBase64(value)!),
    );
    expect([...decoded].reverse().sort(Buffer.compare)).toEqual(decoded);
  });

  test('rejects invalid lengths, characters, and nonzero trailing bits', () => {
    for (const value of [
      '-',
      '0',
      '--=',
      '-0',
      '--0',
      '--\n',
      '!!',
      'zzzz=',
      'OV=',
      'OV===',
      'OV=~',
      'OV~=',
      'Oaxj=',
      '=OV=',
      'OV==AA',
      'OW==',
    ]) {
      expect(utils.fromSortableBase64(value)).toBeUndefined();
    }
  });
});

describe('TypeID 0.3', () => {
  // Official vectors: https://github.com/jetify-com/typeid/tree/23d60e701166f783b9f7175a9114ebfd4bcc22e3/spec
  test('interoperates with the official valid UUID and prefix vectors', () => {
    const vectors = [
      [
        '',
        '00000000000000000000000000',
        '00000000-0000-0000-0000-000000000000',
      ],
      [
        '',
        '00000000000000000000000001',
        '00000000-0000-0000-0000-000000000001',
      ],
      [
        '',
        '0000000000000000000000000a',
        '00000000-0000-0000-0000-00000000000a',
      ],
      [
        '',
        '0000000000000000000000000g',
        '00000000-0000-0000-0000-000000000010',
      ],
      [
        '',
        '00000000000000000000000010',
        '00000000-0000-0000-0000-000000000020',
      ],
      [
        '',
        '7zzzzzzzzzzzzzzzzzzzzzzzzz',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ],
      [
        'prefix',
        'prefix_0123456789abcdefghjkmnpqrs',
        '0110c853-1d09-52d8-d73e-1194e95b5f19',
      ],
      [
        'prefix',
        'prefix_01h455vb4pex5vsknk084sn02q',
        '01890a5d-ac96-774b-bcce-b302099a8057',
      ],
      [
        'pre_fix',
        'pre_fix_00000000000000000000000000',
        '00000000-0000-0000-0000-000000000000',
      ],
    ];
    for (const [prefix, encoded, uuid] of vectors) {
      const bytes = utils.fromUUID(uuid)!;
      expect(utils.toTypeId(bytes, prefix)).toBe(encoded);
      const decoded = utils.fromTypeId(encoded)!;
      expect(decoded.prefix).toBe(prefix);
      expect(utils.toUUID(decoded.id)).toBe(uuid);
      expect(decoded.id).not.toBe(bytes);
    }
  });

  test('rejects the official invalid prefix and suffix cases', () => {
    const zero = '00000000000000000000000000';
    const invalid = [
      `PREFIX_${zero}`,
      `12345_${zero}`,
      `pre.fix_${zero}`,
      `pr\u00e9fix_${zero}`,
      `  prefix_${zero}`,
      `${'a'.repeat(64)}_${zero}`,
      `_${zero}`,
      '_',
      `prefix_${'1'.repeat(25)}`,
      `prefix_${'1'.repeat(27)}`,
      `prefix_${'1'.repeat(25)} `,
      'prefix_0123456789ABCDEFGHJKMNPQRS',
      'prefix_123456789-123456789-123456',
      'prefix_ooooooiiiiiiuuuuuuulllllll',
      'prefix_i23456789ol23456789oi23456',
      'prefix_123456789-0123456789-0123456',
      'prefix_8zzzzzzzzzzzzzzzzzzzzzzzzz',
      `_prefix_${zero}`,
      `prefix__${zero}`,
      '',
      'prefix_',
      `prefix_${zero}\n`,
    ];
    for (const value of invalid) {
      expect(utils.fromTypeId(value), value).toBeUndefined();
    }
  });

  test('validates encoding inputs and accepts the maximum prefix length', () => {
    const bytes = new Uint8Array(16);
    expect(() => utils.toTypeId(new Uint8Array(15))).toThrow(RangeError);
    for (const prefix of ['A', 'a_', '_a', 'a\n', 'a1', 'a'.repeat(64)]) {
      expect(() => utils.toTypeId(bytes, prefix)).toThrow(TypeError);
    }
    for (const prefix of ['a', 'a__b', 'a'.repeat(63)]) {
      expect(utils.fromTypeId(utils.toTypeId(bytes, prefix))?.prefix).toBe(
        prefix,
      );
    }
  });
});
