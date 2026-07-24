// utils/phone.js
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeNepalPhone(input) {
  if (!input) return null;
  let phone = String(input);
  phone = phone.replace(/[\s\-()]/g, "");
  if (phone.startsWith("+977")) phone = phone.slice(4);
  if (phone.startsWith("977")) phone = phone.slice(3);
  return phone;
}

export function isValidNepalPhone(phone) {
  return /^\d{10}$/.test(phone);
}



// Used ONLY for supplier contact numbers — accepts mobile or landline, Nepal or India
export function validateSupplierPhone(input) {
  const raw = String(input || "").trim();

  if (raw.startsWith("+")) {
    const phone = parsePhoneNumberFromString(raw);
    if (!phone || !phone.isValid()) {
      return { valid: false, formatted: null };
    }
    return { valid: true, formatted: phone.number };
  }

  // No country code given — try Nepal first (the default), then fall back
  // to India. This lets bare Indian landlines (e.g. "011-23456789", which
  // doesn't match Nepal's numbering plan) validate correctly too.
  // Note: a bare number that happens to be valid in BOTH countries (most
  // 10-digit mobile numbers) will still resolve to Nepal, since there's no
  // way to know which the person meant without a country code.
  const npPhone = parsePhoneNumberFromString(raw, "NP");
  if (npPhone && npPhone.isValid()) {
    return { valid: true, formatted: npPhone.number };
  }

  const inPhone = parsePhoneNumberFromString(raw, "IN");
  if (inPhone && inPhone.isValid()) {
    return { valid: true, formatted: inPhone.number };
  }

  return { valid: false, formatted: null };
}