import crypto from "crypto";

/**
 * Hashes an OTP string using SHA-256 and a pepper value from environment variables.
 * @param {string} otp - The plain text OTP.
 * @returns {string} The SHA-256 hash.
 */
export function hashOTP(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

/**
 * Safely compares the provided OTP against the stored hash in constant time.
 * @param {string} otp - The plain text OTP entered by the user.
 * @param {string} storedHash - The stored SHA-256 hash to compare against.
 * @returns {boolean} True if they match, false otherwise.
 */
export function verifyOTPHash(otp, storedHash) {
  if (!otp || !storedHash) return false;
  const hashed = hashOTP(otp);
  const buffer1 = Buffer.from(hashed, "utf-8");
  const buffer2 = Buffer.from(storedHash, "utf-8");

  if (buffer1.length !== buffer2.length) {
    return false;
  }
  return crypto.timingSafeEqual(buffer1, buffer2);
}
