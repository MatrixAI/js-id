import { v5 as uuidv5, NIL } from 'uuid';

/**
 * This produces deterministic ids based on:
 * UUIDv5(
 *   SHA1(namespaceUUID + name)
 *   where
 *     namespaceUUID is SHA1(NIL UUID + namespace)
 * )
 */
class IdDeterministic implements IterableIterator<ArrayBuffer> {
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

  public get(name?: string): ArrayBuffer {
    return this.next(name).value as ArrayBuffer;
  }

  public next(name: string = ''): IteratorResult<ArrayBuffer, void> {
    const idData = new ArrayBuffer(16);
    uuidv5(name, this.namespaceData, new Uint8Array(idData));
    return {
      value: idData,
      done: false,
    };
  }

  public [Symbol.iterator](): IterableIterator<ArrayBuffer> {
    return this;
  }
}

export default IdDeterministic;
