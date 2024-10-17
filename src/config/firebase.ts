import admin from "firebase-admin";

const serviceAccount = require("../../serviceAccountKey.json"); // Path to your service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { db };
