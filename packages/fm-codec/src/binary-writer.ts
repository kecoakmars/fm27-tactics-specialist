const textEncoder = new TextEncoder();

export class BinaryWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private cursor = 0;

  constructor(initialCapacity = 1024) {
    this.buffer = new Uint8Array(Math.max(64, initialCapacity));
    this.view = new DataView(this.buffer.buffer);
  }

  get length(): number {
    return this.cursor;
  }

  private ensureCapacity(extraBytes: number): void {
    const needed = this.cursor + extraBytes;
    if (needed <= this.buffer.byteLength) return;
    let nextCap = this.buffer.byteLength * 2;
    while (nextCap < needed) nextCap *= 2;
    const nextBuf = new Uint8Array(nextCap);
    nextBuf.set(this.buffer.subarray(0, this.cursor));
    this.buffer = nextBuf;
    this.view = new DataView(this.buffer.buffer);
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.cursor, value & 0xff);
    this.cursor += 1;
  }

  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.cursor, value & 0xffff, true);
    this.cursor += 2;
  }

  writeInt32(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.cursor, value | 0, true);
    this.cursor += 4;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.cursor, value >>> 0, true);
    this.cursor += 4;
  }

  writeInt64(value: bigint): void {
    this.ensureCapacity(8);
    this.view.setBigInt64(this.cursor, value, true);
    this.cursor += 8;
  }

  writeUint64(value: bigint): void {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.cursor, value, true);
    this.cursor += 8;
  }

  writeBytes(bytes: Uint8Array | readonly number[]): void {
    const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    this.ensureCapacity(arr.byteLength);
    this.buffer.set(arr, this.cursor);
    this.cursor += arr.byteLength;
  }

  writeZeroes(count: number): void {
    if (count <= 0) return;
    this.ensureCapacity(count);
    this.buffer.fill(0, this.cursor, this.cursor + count);
    this.cursor += count;
  }

  writeLengthPrefixedUtf8(text: string): void {
    const encoded = textEncoder.encode(text);
    this.writeInt32(encoded.byteLength);
    this.writeBytes(encoded);
  }

  toUint8Array(): Uint8Array {
    return this.buffer.slice(0, this.cursor);
  }
}
