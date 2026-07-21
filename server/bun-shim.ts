// Polyfills for Bun-specific APIs when running on Node.js (Vercel).
// Bun natively provides these; this module provides Node.js equivalents.

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";

// ─── Bun.password ──────────────────────────────────────────────────────
// Bun's password.hash uses bcrypt. For the demo seed, we use scrypt as a
// Node-compatible alternative. The verify must match the hash algorithm.

// We use a simple prefix to distinguish scrypt hashes from bcrypt:
// "scrypt:" + salt:hash (both hex-encoded)

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("scrypt:")) {
    const [, salt, hash] = stored.split(":");
    const computed = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(hash, "hex");
    if (computed.length !== storedBuf.length) return false;
    return timingSafeEqual(computed, storedBuf);
  }
  // If it's a bcrypt hash (from Bun), it starts with $2
  // We can't verify bcrypt on Node without bcryptjs — just fail gracefully
  return false;
}

export const password = {
  hash(password: string): Promise<string> {
    return Promise.resolve(hashPassword(password));
  },
  hashSync(password: string): string {
    return hashPassword(password);
  },
  verifySync(password: string, storedHash: string): boolean {
    return verifyPassword(password, storedHash);
  },
  verify(password: string, storedHash: string): Promise<boolean> {
    return Promise.resolve(verifyPassword(password, storedHash));
  },
};

// ─── Bun.file ──────────────────────────────────────────────────────────
export function file(path: string) {
  const buf = readFileSync(path);
  return {
    exists(): Promise<boolean> {
      try { readFileSync(path); return Promise.resolve(true); } catch { return Promise.resolve(false); }
    },
    arrayBuffer(): Promise<ArrayBuffer> {
      const b = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return Promise.resolve(b as ArrayBuffer);
    },
    stream(): Readable {
      return Readable.from([buf]);
    },
    text(): Promise<string> {
      return Promise.resolve(buf.toString("utf-8"));
    },
    get size() { return buf.length; },
    get type() { return ""; },
  };
}

// ─── Bun.write ─────────────────────────────────────────────────────────
export async function write(path: string, data: string | Uint8Array | Blob | import("node:stream").Readable | { stream(): Readable; arrayBuffer?(): Promise<ArrayBuffer>; text?(): Promise<string> }) {
  if (typeof data === "string") {
    writeFileSync(path, data);
  } else if (data instanceof Uint8Array) {
    writeFileSync(path, data);
  } else if ((data as any)?.arrayBuffer) {
    const ab = await (data as any).arrayBuffer();
    writeFileSync(path, new Uint8Array(ab));
  } else if ((data as any)?.stream) {
    // If it has .stream() method (BunFile-like), read it
    const chunks: Buffer[] = [];
    for await (const chunk of (data as any).stream()) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    writeFileSync(path, Buffer.concat(chunks));
  } else {
    throw new Error(`Bun.write polyfill: unsupported data type`);
  }
}

export default { password, file, write };
