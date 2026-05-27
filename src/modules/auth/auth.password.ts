import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { env } from "../../config/env.js";

const PASSWORD_ALGORITHM = "scrypt";
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const PASSWORD_RESET_TOKEN_BYTES = 48;
const TWO_FACTOR_SECRET_BYTES = 20;
const TOTP_TIME_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_CODE_COUNT = 8;
const TWO_FACTOR_ENCRYPTION_CONTEXT = "company-erp-two-factor-secret";
const RECOVERY_CODE_HASH_CONTEXT = "company-erp-two-factor-recovery";
const AUTHENTICATOR_ISSUER = "CERP Employee Portal";
const LOWERCASE_PASSWORD_CHARACTERS = "abcdefghjkmnpqrstuvwxyz";
const UPPERCASE_PASSWORD_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBER_PASSWORD_CHARACTERS = "23456789";
const SPECIAL_PASSWORD_CHARACTERS = "!@#$%^&*()-_=+[]{}";

export type PasswordPolicyRequirements = {
  minimumPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
};

function encodeBase32(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(input: string) {
  const normalized = input.replace(/[^A-Z2-7]/gi, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const alphabetIndex = BASE32_ALPHABET.indexOf(character);

    if (alphabetIndex < 0) {
      continue;
    }

    value = (value << 5) | alphabetIndex;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function encodeBase64Url(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);

  return Buffer.from(`${normalized}${padding}`, "base64");
}

function normalizeTotpCode(code: string) {
  return code.replace(/\s+/g, "").trim();
}

function normalizeRecoveryCode(code: string) {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function deriveEncryptionKey() {
  return createHmac("sha256", env.authJwtSecret)
    .update(TWO_FACTOR_ENCRYPTION_CONTEXT)
    .digest()
    .subarray(0, 32);
}

function formatRecoveryCode(input: string) {
  const normalized = normalizeRecoveryCode(input);
  const groups = normalized.match(/.{1,4}/g) ?? [normalized];

  return groups.join("-");
}

function randomCharacter(characters: string) {
  return characters[randomBytes(1)[0] % characters.length] ?? characters[0] ?? "x";
}

function shuffleCharacters(characters: string[]) {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBytes(1)[0] % (index + 1);
    const temporary = characters[index];
    characters[index] = characters[swapIndex] ?? temporary;
    characters[swapIndex] = temporary;
  }

  return characters;
}

function generateTotpAt(secret: string, timestampMs: number) {
  const secretBuffer = decodeBase32(secret);
  const counter = Math.floor(timestampMs / 1000 / TOTP_TIME_STEP_SECONDS);
  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `${PASSWORD_ALGORITHM}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHash] = storedHash.split(":");

  if (
    algorithm !== PASSWORD_ALGORITHM ||
    !salt ||
    !expectedHash ||
    expectedHash.length !== KEY_LENGTH * 2
  ) {
    return false;
  }

  const computedHash = scryptSync(password, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  return timingSafeEqual(computedHash, expectedBuffer);
}

export function generatePasswordResetToken() {
  return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
}

export function generateTemporaryPassword(
  policy: Partial<PasswordPolicyRequirements> = {},
) {
  const minimumPasswordLength = Math.max(
    Number(policy.minimumPasswordLength ?? 12),
    12,
  );
  const passwordCharacters = [
    randomCharacter(UPPERCASE_PASSWORD_CHARACTERS),
    randomCharacter(LOWERCASE_PASSWORD_CHARACTERS),
    randomCharacter(NUMBER_PASSWORD_CHARACTERS),
    randomCharacter(SPECIAL_PASSWORD_CHARACTERS),
  ];
  const basePool = [
    UPPERCASE_PASSWORD_CHARACTERS,
    LOWERCASE_PASSWORD_CHARACTERS,
    NUMBER_PASSWORD_CHARACTERS,
    SPECIAL_PASSWORD_CHARACTERS,
  ].join("");

  while (passwordCharacters.length < minimumPasswordLength) {
    passwordCharacters.push(randomCharacter(basePool));
  }

  return shuffleCharacters(passwordCharacters).join("");
}

export function hashPasswordResetToken(token: string) {
  return createHmac("sha256", env.authPasswordResetTokenSecret)
    .update(token)
    .digest("hex");
}

export function generateTwoFactorSecret() {
  return encodeBase32(randomBytes(TWO_FACTOR_SECRET_BYTES));
}

export function encryptTwoFactorSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${encodeBase64Url(iv)}.${encodeBase64Url(authTag)}.${encodeBase64Url(
    encrypted,
  )}`;
}

export function decryptTwoFactorSecret(payload: string) {
  const [ivSegment, authTagSegment, encryptedSegment] = payload.split(".");

  if (!ivSegment || !authTagSegment || !encryptedSegment) {
    throw new Error("Invalid encrypted two-factor secret payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(),
    decodeBase64Url(ivSegment),
  );

  decipher.setAuthTag(decodeBase64Url(authTagSegment));

  return Buffer.concat([
    decipher.update(decodeBase64Url(encryptedSegment)),
    decipher.final(),
  ]).toString("utf8");
}

export function buildAuthenticatorOtpAuthUrl(
  email: string,
  secret: string,
  issuer = AUTHENTICATOR_ISSUER,
) {
  const label = encodeURIComponent(`${issuer}:${email.toLowerCase()}`);
  const encodedIssuer = encodeURIComponent(issuer);

  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_TIME_STEP_SECONDS}`;
}

export function verifyTwoFactorCode(secret: string, code: string, window = 1) {
  const normalizedCode = normalizeTotpCode(code);

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const now = Date.now();

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = generateTotpAt(
      secret,
      now + offset * TOTP_TIME_STEP_SECONDS * 1000,
    );

    if (candidate === normalizedCode) {
      return true;
    }
  }

  return false;
}

export function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    formatRecoveryCode(randomBytes(6).toString("hex").slice(0, 12)),
  );
}

export function hashRecoveryCode(code: string) {
  return createHmac("sha256", env.authPasswordResetTokenSecret)
    .update(`${RECOVERY_CODE_HASH_CONTEXT}:${normalizeRecoveryCode(code)}`)
    .digest("hex");
}
