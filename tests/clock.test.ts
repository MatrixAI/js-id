import { afterEach, describe, expect, test, vi } from 'vitest';
import { readEpochMilliseconds } from '#clock.js';
import { IdFlake, IdSortable, utils } from '#index.js';

const originalPerformance = Object.getOwnPropertyDescriptor(
  globalThis,
  'performance',
);

function setPerformance(value: unknown): void {
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalPerformance == null) {
    Reflect.deleteProperty(globalThis, 'performance');
  } else {
    Object.defineProperty(globalThis, 'performance', originalPerformance);
  }
});

describe('portable epoch sampling', () => {
  test('preserves the performance receiver and fractional milliseconds', () => {
    setPerformance({
      timeOrigin: 1000,
      now() {
        expect(this.timeOrigin).toBe(1000);
        return 5.75;
      },
    });
    const wall = vi.spyOn(Date, 'now').mockReturnValue(1);
    expect(readEpochMilliseconds()).toBe(1005.75);
    expect(wall).not.toHaveBeenCalled();
  });

  test.each([
    undefined,
    null,
    {},
    { now: () => 1 },
    { timeOrigin: 1000 },
    { timeOrigin: NaN, now: () => 1 },
    { timeOrigin: 1000, now: () => null },
    { timeOrigin: 1000, now: () => false },
    { timeOrigin: 1000, now: () => Infinity },
    { timeOrigin: 8.64e15, now: () => 100 },
    {
      timeOrigin: 1000,
      now: () => {
        throw new Error('restricted');
      },
    },
  ])('falls back from an unusable performance capability: %p', (value) => {
    setPerformance(value);
    vi.spyOn(Date, 'now').mockReturnValue(42);
    expect(readEpochMilliseconds()).toBe(42);
  });

  test('falls back from a throwing global getter', () => {
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      get() {
        throw new Error('restricted');
      },
    });
    vi.spyOn(Date, 'now').mockReturnValue(42);
    expect(readEpochMilliseconds()).toBe(42);
  });

  test('rejects invalid fallback readings and propagates fallback failures', () => {
    setPerformance(undefined);
    const wall = vi.spyOn(Date, 'now').mockReturnValue(NaN);
    expect(() => readEpochMilliseconds()).toThrow(RangeError);
    wall.mockReturnValue(8.64e15 + 1);
    expect(() => readEpochMilliseconds()).toThrow(RangeError);
    wall.mockImplementation(() => {
      throw new Error('wall clock failed');
    });
    expect(() => readEpochMilliseconds()).toThrow('wall clock failed');
  });

  test('fallback clocks retain generator ordering across rollback and recover after exhaustion', () => {
    setPerformance(undefined);
    const wall = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const sortable = new IdSortable({
      randomSource: (size) => new Uint8Array(size),
    });
    const flake = new IdFlake({
      sequenceBits: 1,
      randomSource: (size) => new Uint8Array(size),
    });
    const first = sortable.get();
    const flakeFirst = flake.get();
    const flakeLast = flake.get();
    wall.mockReturnValue(900);
    expect(first < sortable.get()).toBe(true);
    expect(flake.tryGet()).toBeUndefined();
    expect(flakeFirst < flakeLast).toBe(true);
    wall.mockReturnValue(NaN);
    expect(() => sortable.tryGet()).toThrow(RangeError);
    expect(() => flake.tryGet()).toThrow(RangeError);
    wall.mockReturnValue(1001);
    expect(flakeLast < flake.get()).toBe(true);
    expect(utils.timeSource(1100)()).toBe(1100);
  });

  test('restores persisted generator state when the fallback wall clock moved backwards', () => {
    setPerformance(undefined);
    const wall = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const randomSource = (size: number) => new Uint8Array(size);
    const original = new IdSortable({ randomSource });
    original.get();
    const persisted = original.get();
    wall.mockReturnValue(900);
    const restored = new IdSortable({ lastId: persisted, randomSource });
    const next = restored.get();
    expect(persisted < next).toBe(true);
    expect(utils.readUint48BE(next, 0)).toBe(1000);
    expect(next[7]).toBe(persisted[7] + 1);
  });
});
