import type { MultibaseFormats } from './utils.js';
import * as utils from './utils.js';

/**
 * IdInternal can be used as a string primitive
 * This type hack (as a number) prevents TS from complaining
 * See: https://github.com/microsoft/TypeScript/issues/4538
 */
type Id<T extends IdInternal = IdInternal> = T & number;

/**
 * Mutable binary identifier of arbitrary byte length.
 *
 * Primitive coercion yields a binary string in byte order. Buffer conversion
 * shares storage, while construction from an array-like ID copies its bytes.
 * Static factories construct the receiver subclass; mutating bytes can change
 * subsequent object-key coercion.
 */
class IdInternal extends Uint8Array {
  /** Constructs the receiver class using Uint8Array constructor semantics. */
  public static create<
    C extends typeof IdInternal,
    R extends Id<InstanceType<C>> = Id<InstanceType<C>>,
  >(
    this: C,
    ...args:
      | []
      | [number | ArrayLike<number> | ArrayBufferLike]
      | [ArrayBufferLike, number | undefined, number?]
  ): R;
  public static create<T extends Id = Id>(): T;
  public static create<T extends Id = Id>(id: T): T;
  public static create<T extends Id = Id>(length: number): T;
  public static create<T extends Id = Id>(
    array: ArrayLike<number> | ArrayBufferLike,
  ): T;
  public static create<T extends Id = Id>(
    buffer: ArrayBufferLike,
    byteOffset?: number,
    length?: number,
  ): T;
  public static create<T extends Id = Id>(...args: Array<any>): T {
    if (args.length === 0) return new this() as T;
    if (args.length === 1) return new this(args[0]) as T;
    if (args.length === 2) return new this(args[0], args[1]) as T;
    if (args.length === 3) return new this(args[0], args[1], args[2]) as T;
    return Reflect.construct(this, args) as T;
  }

  /** Decodes a binary string into a new instance of the receiver class. */
  public static fromString<
    C extends typeof IdInternal,
    R extends Id<InstanceType<C>> = Id<InstanceType<C>>,
  >(this: C, idString: string): R;
  public static fromString<T extends Id = Id>(idString: string): T;
  public static fromString(idString: string): Id {
    const id = utils.fromString(idString);
    return this.create(id.buffer, id.byteOffset, id.byteLength);
  }

  /** Decodes the supported JSON shape, or returns undefined when invalid. */
  public static fromJSON<
    C extends typeof IdInternal,
    R extends Id<InstanceType<C>> = Id<InstanceType<C>>,
  >(this: C, json: any): R | undefined;
  public static fromJSON<T extends Id = Id>(json: any): T | undefined;
  public static fromJSON(json: any): Id | undefined {
    const id = utils.fromJSON(json);
    return id == null
      ? undefined
      : this.create(id.buffer, id.byteOffset, id.byteLength);
  }

  /**
   * Decodes as Buffer zero-copy
   */
  public static fromBuffer<
    C extends typeof IdInternal,
    R extends Id<InstanceType<C>> = Id<InstanceType<C>>,
  >(this: C, idBuffer: Buffer): R;
  public static fromBuffer<T extends Id = Id>(idBuffer: Buffer): T;
  public static fromBuffer(idBuffer: Buffer): Id {
    return this.create(
      idBuffer.buffer,
      idBuffer.byteOffset,
      idBuffer.byteLength,
    );
  }

  /** Decodes canonical UUID text into the receiver class, or returns undefined. */
  public static fromUUID<
    C extends typeof IdInternal,
    R extends Id<InstanceType<C>> = Id<InstanceType<C>>,
  >(this: C, uuid: string): R | undefined;
  public static fromUUID<T extends Id = Id>(uuid: string): T | undefined;
  public static fromUUID(uuid: string): Id | undefined {
    const id = utils.fromUUID(uuid);
    return id == null
      ? undefined
      : this.create(id.buffer, id.byteOffset, id.byteLength);
  }

  /** Decodes supported multibase text into the receiver class, if valid. */
  public static fromMultibase<
    C extends typeof IdInternal,
    R extends Id<InstanceType<C>> = Id<InstanceType<C>>,
  >(this: C, idString: string): R | undefined;
  public static fromMultibase<T extends Id = Id>(
    idString: string,
  ): T | undefined;
  public static fromMultibase(idString: string): Id | undefined {
    const id = utils.fromMultibase(idString);
    return id == null
      ? undefined
      : this.create(id.buffer, id.byteOffset, id.byteLength);
  }

  /** Produces the binary-string primitive used for keys and comparisons. */
  public [Symbol.toPrimitive](_hint: 'string' | 'number' | 'default'): string {
    return utils.toString(this as unknown as Id);
  }

  /** Returns one string code unit per byte. */
  public toString(): string {
    return utils.toString(this as unknown as Id);
  }

  /** Returns the JSON representation with an independent array of byte values. */
  public toJSON(): { type: string; data: Array<number> } {
    return utils.toJSON(this);
  }

  /**
   * Encodes as Buffer zero-copy
   */
  public toBuffer(): Buffer {
    return utils.toBuffer(this);
  }

  /**
   * Encodes as a 16 byte UUID
   * This only works when the Id is 16 bytes long
   */
  public toUUID(): string {
    return utils.toUUID(this);
  }

  /**
   * Encodes an multibase ID string
   */
  public toMultibase(format: MultibaseFormats): string {
    return utils.toMultibase(this, format);
  }

  /**
   * Efficiently compares for equality
   * This is faster than comparing by binary string
   * If you have an ArrayBuffer, wrap it in Uint8Array first
   */
  public equals(id: Uint8Array): boolean {
    return utils.equals(this, id);
  }
}

export default IdInternal;

export type { Id };
