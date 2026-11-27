/**
 * HS256 access tokens (standard JWT). Verified against the DB on every
 * request; a token only names the user.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { TOKEN_TTL_SECONDS, JWT_SECRET } from "./config";

const HEADER = { alg: "HS256", typ: "JWT" };

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function sign(data: string): string {
  return base64UrlEncode(createHmac("sha256", JWT_SECRET).update(data).digest());
}

interface TokenPayload {
  sub: string;
  exp: number;
}

export class TokenService {
  /** Issue a signed token for the user id, expiring after TOKEN_TTL_SECONDS. */
  issue(userId: string, now: Date): string {
    const payload: TokenPayload = {
      sub: userId,
      exp: Math.floor(now.getTime() / 1000) + TOKEN_TTL_SECONDS,
    };
    const header = base64UrlEncode(JSON.stringify(HEADER));
    const body = base64UrlEncode(JSON.stringify(payload));
    return `${header}.${body}.${sign(`${header}.${body}`)}`;
  }

  /** Verify signature and expiry; returns the user id or throws TokenError. */
  verify(token: string, now: Date): string {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new TokenError("malformed token");
    }
    const [header, body, signature] = parts;
    const expected = sign(`${header}.${body}`);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new TokenError("invalid signature");
    }
    let payload: TokenPayload;
    try {
      payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as TokenPayload;
    } catch {
      throw new TokenError("malformed token payload");
    }
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
      throw new TokenError("malformed token payload");
    }
    if (payload.exp <= Math.floor(now.getTime() / 1000)) {
      throw new TokenError("expired token");
    }
    return payload.sub;
  }
}

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}
