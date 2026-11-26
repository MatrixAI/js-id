import { describe, expect, test } from 'vitest';
import {
  IdDeterministic,
  IdFlake,
  IdRandom,
  IdSortable,
  utils,
} from '#index.js';

describe('Cloudflare Worker runtime', () => {
  test('CASE-ID-RUNTIME-WORKER: imports the compiled package and derives the RFC name-based vector', () => {
    const namespace = utils.fromUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    expect(
      new IdDeterministic({ namespace }).get('www.example.com').toUUID(),
    ).toBe('5c146b14-3c52-8afd-938a-375d0df1fbf6');
    expect(new IdRandom().get()[6] >> 4).toBe(4);
    expect(new IdSortable().get()[6] >> 4).toBe(7);
  });

  test('CASE-ID-RUNTIME-WORKER: reports exhaustion and resumes only when the injected clock advances', () => {
    let now = 1000;
    const generator = new IdSortable({
      timeSource: () => () => now,
      randomSource: (size) => new Uint8Array(size),
    });
    for (let i = 0; i < 4096; i++) generator.get();
    expect(generator.tryGet()).toBeUndefined();
    now++;
    expect(generator.tryGet()).toBeDefined();
  });

  test('CASE-ID-RUNTIME-WORKER: restores monotonic state after a clock rollback', () => {
    const initial = new IdFlake({
      nodeId: Uint8Array.of(0),
      nodeBits: 1,
      sequenceBits: 2,
      timeSource: () => () => 1000,
      randomSource: (size) => new Uint8Array(size),
    });
    const previous = initial.get();
    const restored = new IdFlake({
      nodeId: Uint8Array.of(0),
      nodeBits: 1,
      sequenceBits: 2,
      lastId: previous,
      timeSource: () => () => 999,
      randomSource: (size) => new Uint8Array(size),
    });
    expect(restored.get() > previous).toBe(true);
  });
});
