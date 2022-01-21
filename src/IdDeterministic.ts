import type { Id } from './Id';

import { v5 as uuidv5, NIL } from 'uuid';
import IdInternal from './Id';

/**
 * This produces deterministic ids based on:
 * UUIDv5(
 *   SHA1(namespaceUUID + name)
 *   where
 *     namespaceUUID is SHA1(NIL UUID + namespace)
 * )
 */
class IdDeterministic<T extends Id = Id> implements IterableIterator<T> {
  protected namespaceData: Uint8Array;

  public constructor({
    namespace = '',
  }: {
    namespace?: string;
  } = {}) {
    const namespaceData = new Uint8Array(16);
    uuidv5(namespace, NIL, namespaceData);
    this.namespaceData = namespaceData;
  }

  public get(name?: string): T {
    return this.next(name).value as T;
  }

  public next(name: string = ''): IteratorResult<T, void> {
    const id = IdInternal.create<T>(16);
    uuidv5(name, this.namespaceData, id);
    return {
      value: id,
      done: false,
    };
  }

  public [Symbol.iterator](): IterableIterator<T> {
    return this;
  }
}

export default IdDeterministic;
