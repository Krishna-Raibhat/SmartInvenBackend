import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const FALLBACK_KEY = "development-fallback-secret-key-32-chars!";

// Generate a 32-byte key from the configured environment secret (or fallback key)
const getSecretKey = () => {
  const secret = process.env.TWO_FACTOR_ENCRYPTION_KEY || FALLBACK_KEY;
  return crypto.scryptSync(secret, "salt-string-for-smartinven-2fa", 32);
};

/**
 * Encrypt plain-text TOTP secret before saving to DB
 */
export function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  // Format: iv:encryptedData:authTag
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

/**
 * Decrypt TOTP secret retrieved from DB
 */
export function decryptSecret(encryptedText) {
  const [ivHex, encryptedHex, authTagHex] = encryptedText.split(":");
  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getSecretKey();
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
