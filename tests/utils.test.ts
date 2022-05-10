import * as uuid from 'uuid';
import * as utils from '@/utils';

describe('utils', () => {
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
    // Use uuid library to confirm
    const bytes2 = uuid.v4({}, new Uint8Array(16));
    const id2 = uuid.stringify([...bytes2]);
    expect(utils.toUUID(bytes2)).toBe(id2);
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
    const fp1 = 1633860855.1015312; // eslint-disable-line @typescript-eslint/no-loss-of-precision
    const fixed1 = utils.toFixedPoint(fp1, 12, 3);
    expect(fixed1[1]).toBe(417);
    const fp1_ = utils.fromFixedPoint(fixed1, 12, 3);
    expect(fp1_).toBe(utils.roundPrecise(fp1, 3));
    // Also to 3 decimal places
    // expecting 0.101 now
    const fp2 = 1633860855.1014312; // eslint-disable-line @typescript-eslint/no-loss-of-precision
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
    // FromMultibase should only allow 16 byte ids
    expect(utils.fromMultibase('aAQ3')).toBeUndefined();
    expect(utils.fromMultibase('aAQ333333333333333AAAAAA')).toBeUndefined();
    expect(
      utils.fromMultibase('zF4VfF3uRhSqgxTOOLONGxTRdVKauV9'),
    ).toBeUndefined();
    expect(utils.fromMultibase('zFxTOOSHORTx9')).toBeUndefined();
    expect(utils.fromMultibase('helloworld')).toBeUndefined();
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
