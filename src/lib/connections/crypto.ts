import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
function key() {
  const value = process.env.LAPIS_CONNECTIONS_KEY;
  if (!value || !/^[a-f\d]{64}$/i.test(value))
    throw new Error("Connections are not configured");
  return Buffer.from(value, "hex");
}
export function seal(value: unknown, context: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((v) => v.toString("base64url"))
    .join(".");
}
export function unseal<T>(value: string, context: string): T {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted value");
  const [iv, tag, encrypted] = parts.map((v) => Buffer.from(v, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      "utf8",
    ),
  );
}
export function equalState(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
