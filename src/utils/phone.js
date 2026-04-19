// utils/phone.js
export const normalizeNepalPhone = (input) => {
  if (!input) return null;

  let phone = String(input);

  // remove spaces, dashes, brackets
  phone = phone.replace(/[\s\-()]/g, "");

  // remove +977 or 977 prefix
  if (phone.startsWith("+977")) phone = phone.slice(4);
  if (phone.startsWith("977")) phone = phone.slice(3);

  return phone;
};

export const isValidNepalPhone = (phone) => /^\d{10}$/.test(phone);
