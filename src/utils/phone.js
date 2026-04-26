// utils/phone.js
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
