// Aegis protocol — identity & cryptography primitives.
//
// Every actor in Aegis (a human principal, an AI agent, a merchant) is a
// keypair. Identity is self-certifying: a DID is just the public key encoded
// inline, so any verifier can extract the key from the identifier and check a
// signature with zero trusted third parties and no PKI/CA to bootstrap. (A
// registry/PKI can be layered on top later for revocation lists and human-
// readable names — see revocation.js — but it is never required to verify a
// signature.)

import {
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  createPublicKey,
  randomBytes,
} from "node:crypto";

const DID_PREFIX = "did:aegis:";

export function base64urlEncode(buf) {
  return Buffer.from(buf).toString("base64url");
}

export function base64urlDecode(str) {
  return Buffer.from(str, "base64url");
}

// Raw 32-byte Ed25519 public key <-> Node KeyObject. We extract the raw key
// from the DER/JWK so identities are compact and transport-friendly.
function rawPublicKeyFromKeyObject(keyObject) {
  const jwk = keyObject.export({ format: "jwk" });
  return base64urlDecode(jwk.x);
}

function keyObjectFromRawPublicKey(raw) {
  return createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: base64urlEncode(raw) },
    format: "jwk",
  });
}

// Create a fresh identity. Returns the DID, the public KeyObject, and the
// private KeyObject. Only the holder ever sees the private key.
export function createIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = rawPublicKeyFromKeyObject(publicKey);
  return {
    did: DID_PREFIX + base64urlEncode(raw),
    publicKey,
    privateKey,
  };
}

export function isAegisDid(did) {
  return typeof did === "string" && did.startsWith(DID_PREFIX);
}

// Recover a verifiable public key straight out of a DID. This is the move that
// removes the trusted third party: the identifier *is* the key.
export function publicKeyFromDid(did) {
  if (!isAegisDid(did)) throw new Error(`not an aegis DID: ${did}`);
  const raw = base64urlDecode(did.slice(DID_PREFIX.length));
  if (raw.length !== 32) throw new Error("invalid Ed25519 key length in DID");
  return keyObjectFromRawPublicKey(raw);
}

// Deterministic, canonical JSON so a signature covers exactly one byte string.
// Keys are sorted recursively; undefined values are dropped.
export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") +
    "}"
  );
}

// Sign the canonical form of `payload` (a plain object) with a private key.
export function signPayload(payload, privateKey) {
  const message = Buffer.from(canonicalize(payload), "utf8");
  return base64urlEncode(edSign(null, message, privateKey));
}

// Verify a signature over `payload` against the public key inside `signerDid`.
export function verifyPayload(payload, signatureB64, signerDid) {
  try {
    const publicKey = publicKeyFromDid(signerDid);
    const message = Buffer.from(canonicalize(payload), "utf8");
    return edVerify(null, message, publicKey, base64urlDecode(signatureB64));
  } catch {
    return false;
  }
}

export function newNonce() {
  return base64urlEncode(randomBytes(12));
}

export function newId(prefix) {
  return `${prefix}_${base64urlEncode(randomBytes(9))}`;
}
