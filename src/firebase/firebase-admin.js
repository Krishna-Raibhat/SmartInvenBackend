const admin = require("firebase-admin");
const serviceAccount = require("./firebase.json"); // path relative to src/firebase/

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
