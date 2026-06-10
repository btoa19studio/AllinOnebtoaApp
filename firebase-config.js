// ============================================================
//  firebase-config.js
//  Ganti nilai di bawah dengan konfigurasi Firebase project Anda.
//  Dapatkan konfigurasi dari: Firebase Console → Project Settings
// ============================================================

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);

// Export referensi layanan
const auth = firebase.auth();
const db   = firebase.firestore();

// Aktifkan persistensi offline Firestore (opsional tapi direkomendasikan)
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence: not supported in this browser');
    }
  });
