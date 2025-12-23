// src/utils/apiResponse.js
exports.sendSuccess = (res, status, message, data = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(status).json(payload);
};

exports.sendError = (res, status, errorCode, message, details = null) => {
  const payload = { success: false, errorCode, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
};

// Safe numeric parsing
exports.toPositiveInt = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
};

exports.toMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};
