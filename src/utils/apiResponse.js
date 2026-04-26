// src/utils/apiResponse.js
export function sendSuccess(res, status, message, data = null) {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(status).json(payload);
}

export function sendError(res, status, errorCode, message, details = null) {
  const payload = { success: false, errorCode, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

export function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
