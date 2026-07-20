// Generate a secure random OTP_PEPPER
// Run this file once: node generate-pepper.js

const crypto = require('crypto');

const pepper = crypto.randomBytes(32).toString('hex');

console.log('\n🔐 YOUR SECURE OTP_PEPPER:\n');
console.log(pepper);
console.log('\n📋 Copy the line below and add it to your .env file:\n');
console.log(`OTP_PEPPER=${pepper}`);
console.log('\n⚠️  IMPORTANT: Never commit this to git!\n');
