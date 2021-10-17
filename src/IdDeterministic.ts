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
class IdDeterministic implements IterableIterator<Id> {
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

  public get(name?: string): Id {
    return this.next(name).value as Id;
  }

  public next(name: string = ''): IteratorResult<Id, void> {
    const id = IdInternal.create(16);
    uuidv5(name, this.namespaceData, id);
    return {
      value: id,
      done: false,
    };
  }

  public [Symbol.iterator](): IterableIterator<Id> {
    return this;
  }
}

export default IdDeterministic;
