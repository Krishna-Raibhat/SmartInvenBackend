import { validateSupplierPhone } from "./src/utils/phone.js";

function run(label, number) {
  const result = validateSupplierPhone(number);
  console.log(`${label.padEnd(28)} | ${number.padEnd(20)} -> ${JSON.stringify(result)}`);
}

console.log("\n=== NEPAL MOBILE — NTC (Nepal Telecom) ===");
run("NTC, no code",        "9841234567");
run("NTC, dashed",         "984-123-4567");
run("NTC, +977",           "+977-9841234567");
run("NTC, 985 prefix",     "9851234567");
run("NTC, 986 prefix",     "9861234567");

console.log("\n=== NEPAL MOBILE — Ncell ===");
run("Ncell, no code",      "9801234567");
run("Ncell, dashed",       "980-123-4567");
run("Ncell, +977",         "+977-9801234567");
run("Ncell, 981 prefix",   "9811234567");
run("Ncell, 982 prefix",   "9821234567");

console.log("\n=== NEPAL LANDLINE ===");
run("Kathmandu, no code",   "01-4567890");
run("Kathmandu, no dash",   "014567890");
run("Kathmandu, +977",      "+977-1-4567890");
run("Pokhara, no code",     "061-523456");
run("Pokhara, +977",        "+977-61-523456");
run("Biratnagar, no code",  "021-456789");
run("Biratnagar, +977",     "+977-21-456789");

console.log("\n=== INDIA LANDLINE ===");
run("Delhi, no code",       "011-23456789");
run("Delhi, +91",           "+91-11-23456789");
run("Mumbai, no code",      "022-23456789");
run("Mumbai, +91",          "+91-22-23456789");
run("Bengaluru, no code",   "080-23456789");
run("Bengaluru, +91",       "+91-80-23456789");

console.log("\n=== INDIA MOBILE ===");
run("India mobile, +91",    "+91-9876543210");
run("India mobile, no code (ambiguous — will resolve to Nepal)", "9876543210");

console.log("\n=== INVALID / GARBAGE (should all be false) ===");
run("Empty",                "");
run("Letters",              "abcdefghij");
run("Too short",            "12345");
run("All zeros",            "0000000000");

console.log("\nDone.\n");