import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const RECLAIM_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export type ReclaimPayload = {
  roomId: string;
  userName: string;
  joinTs: number;
  v: 1;
};

const b64urlEncode = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const b64urlDecode = (input: string): Buffer => {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
};

export const signReclaimToken = (
  secret: string,
  payload: ReclaimPayload
): string => {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = b64urlEncode(payloadStr);
  const sig = createHmac("sha256", secret).update(payloadStr).digest();
  const sigB64 = b64urlEncode(sig);
  return `${payloadB64}.${sigB64}`;
};

export const verifyReclaimToken = (
  secret: string,
  token: string,
  roomId: string,
  userName: string,
  now: number
): { valid: boolean; joinTs?: number } => {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) {
    return { valid: false };
  }
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  let payloadStr: string;
  try {
    payloadStr = b64urlDecode(payloadB64).toString("utf8");
  } catch {
    return { valid: false };
  }

  let payload: ReclaimPayload;
  try {
    payload = JSON.parse(payloadStr) as ReclaimPayload;
  } catch {
    return { valid: false };
  }

  if (
    typeof payload.roomId !== "string" ||
    typeof payload.userName !== "string" ||
    typeof payload.joinTs !== "number" ||
    payload.v !== 1
  ) {
    return { valid: false };
  }

  // Bind to the room and username being attempted — token cannot be replayed
  // on a different room or for a different username.
  if (payload.roomId !== roomId || payload.userName !== userName) {
    return { valid: false };
  }

  // Enforce freshness so a leaked token cannot be reused indefinitely.
  if (now - payload.joinTs > RECLAIM_WINDOW_MS || now < payload.joinTs) {
    return { valid: false };
  }

  // Constant-time signature comparison — never leak timing info to network.
  const expectedSig = createHmac("sha256", secret).update(payloadStr).digest();
  const actualSig = b64urlDecode(sigB64);
  if (
    actualSig.length !== expectedSig.length ||
    !timingSafeEqual(actualSig, expectedSig)
  ) {
    return { valid: false };
  }

  return { valid: true, joinTs: payload.joinTs };
};
