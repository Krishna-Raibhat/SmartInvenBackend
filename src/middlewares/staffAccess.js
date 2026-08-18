// src/middlewares/staffAccess.js
//
// Staff accounts are deliberately restricted to a whitelist of routes.
// Anything not listed here is blocked by default for staff tokens.
// Update this list if the allowed staff feature set changes.

const ALLOWED_STAFF_ROUTES = [
  // Self-service profile
  { method: "GET", pattern: /^\/api\/staff\/me$/ },
  { method: "PUT", pattern: /^\/api\/staff\/me$/ },

  // Product catalog — staff can add, view, and delete categories, units, products
  { method: "GET", pattern: /^\/api\/store\/categories(\/[^/]+)?$/ },
  { method: "POST", pattern: /^\/api\/store\/categories$/ },
  { method: "DELETE", pattern: /^\/api\/store\/categories\/[^/]+$/ },
  { method: "GET", pattern: /^\/api\/store\/units(\/[^/]+)?$/ },
  { method: "POST", pattern: /^\/api\/store\/units$/ },
  { method: "DELETE", pattern: /^\/api\/store\/units\/[^/]+$/ },
  { method: "GET", pattern: /^\/api\/store\/products(\/[^/]+)?$/ },
  { method: "POST", pattern: /^\/api\/store\/products$/ },
  { method: "DELETE", pattern: /^\/api\/store\/products\/[^/]+$/ },

  // Stock lots — view only (no create/edit/delete); cp is stripped from the response
  { method: "GET", pattern: /^\/api\/store\/stock-lots$/ },
  { method: "GET", pattern: /^\/api\/store\/stock-lots\/product\/[^/]+$/ },
  { method: "GET", pattern: /^\/api\/store\/stock-lots\/[^/]+$/ },

  // Stock lots via the sync API — same view-only access as above, just a
  // different controller/route surface for the same data.
  { method: "GET", pattern: /^\/api\/store\/sync\/stock-lots\/product\/[^/]+$/ },

  // Sales — full create/list/pay flow; cp is stripped from the response
  { method: "POST", pattern: /^\/api\/store\/sales$/ },
  { method: "GET", pattern: /^\/api\/store\/sales$/ },
  { method: "GET", pattern: /^\/api\/store\/sales\/credit$/ },
  { method: "GET", pattern: /^\/api\/store\/sales\/[^/]+$/ },
  { method: "PATCH", pattern: /^\/api\/store\/sales\/[^/]+\/pay$/ },

  // Customer returns — same access as owner
  { method: "POST", pattern: /^\/api\/store\/returns\/customer$/ },
  { method: "GET", pattern: /^\/api\/store\/returns\/customer(\/[^/]+)?$/ },

  // Customer credit — same access as owner
  { method: "GET", pattern: /^\/api\/stock-out\/credit$/ },

  // Reminders — add + view + remove
  { method: "POST", pattern: /^\/api\/store\/customer-reminders$/ },
  { method: "GET", pattern: /^\/api\/store\/customer-reminders$/ },
  { method: "DELETE", pattern: /^\/api\/store\/customer-reminders\/[^/]+$/ },

  // Notifications — list, mark read, threshold
  { method: "GET", pattern: /^\/api\/store\/notifications$/ },
  { method: "POST", pattern: /^\/api\/store\/notifications\/read-all$/ },
  { method: "POST", pattern: /^\/api\/store\/notifications\/[^/]+\/read$/ },
  { method: "DELETE", pattern: /^\/api\/store\/notifications\/[^/]+$/ },
  { method: "GET", pattern: /^\/api\/store\/notifications\/threshold$/ },
  { method: "PUT", pattern: /^\/api\/store\/notifications\/threshold$/ },

  // Low-stock alerts
  { method: "GET", pattern: /^\/api\/store\/reports\/stock-alerts$/ },
];

export function isRouteAllowedForStaff(method, path) {
  return ALLOWED_STAFF_ROUTES.some(
    (r) => r.method === method && r.pattern.test(path),
  );
}

// Cost price ("cp") must never reach a staff account — strip it recursively
// from any response body before it goes out. Only plain objects/arrays are
// recursed into; Date, Decimal, and other class instances are left as-is so
// their normal JSON serialization (toJSON) still runs.
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function stripCp(value) {
  if (Array.isArray(value)) {
    return value.map(stripCp);
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === "cp") continue;
      out[key] = stripCp(val);
    }
    return out;
  }
  return value;
}

export function hideCostPriceForStaff(req, res, next) {
  if (req.staff) {
    const originalJson = res.json.bind(res);
    res.json = (body) => originalJson(stripCp(body));
  }
  next();
}