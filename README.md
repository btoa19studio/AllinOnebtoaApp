# 🗂️ All in One App

Aplikasi web lengkap berbasis Firebase yang menggabungkan **Sticky Notes**, **To Do List**, **Perjalanan (GPS Timeline)**, dan **Kalender** dalam satu platform terintegrasi — dengan autentikasi pengguna via Firebase.

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|---|---|
| 🔐 Auth | Signup & Login via Firebase Authentication |
| 👤 Profil | Update nama, bio, dan warna avatar |
| 🗒️ Sticky Notes | CRUD catatan berwarna dengan filter pencarian |
| ✅ To Do List | Kelola tugas dengan prioritas, deadline & status |
| 🗺️ Perjalanan | Rekam GPS real-time → tampil di peta + timeline |
| 📅 Kalender | Sinkronisasi otomatis dari Notes, Todos, dan Perjalanan |

---

## 🏗️ Struktur Proyek

```
All-in-One-App/
├── index.html          # Shell SPA utama (semua halaman dalam 1 file)
├── style.css           # Semua styling (layout, komponen, responsif)
├── main.js             # Logika aplikasi (auth, CRUD, peta, kalender)
├── firebase-config.js  # Konfigurasi Firebase ← ISI DENGAN DATA KAMU
├── README.md           # Dokumentasi ini
└── assets/
    └── icons/          # Ikon dan aset tambahan
```

---

## 🚀 Cara Setup & Menjalankan

### 1. Buat Firebase Project

1. Buka [https://console.firebase.google.com](https://console.firebase.google.com)
2. Klik **"Add project"** → beri nama → klik **Continue** hingga selesai
3. Di halaman project, klik ikon **`</>`** (Web) → daftarkan app → salin konfigurasi

### 2. Aktifkan Firebase Authentication

1. Di sidebar Firebase Console → **Build → Authentication**
2. Klik **"Get started"**
3. Tab **Sign-in method** → aktifkan **Email/Password** → klik **Save**

### 3. Buat Firestore Database

1. Di sidebar → **Build → Firestore Database**
2. Klik **"Create database"**
3. Pilih **"Start in test mode"** *(untuk development — ubah rules sebelum production)*
4. Pilih region terdekat (misal: `asia-southeast2` untuk Jakarta) → klik **Enable**

### 4. Isi `firebase-config.js`

Buka file `firebase-config.js` dan ganti placeholder dengan konfigurasi Firebase kamu:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",         // dari Firebase Console
  authDomain:        "myapp.firebaseapp.com",
  projectId:         "myapp-12345",
  storageBucket:     "myapp-12345.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

> 💡 Lokasi konfigurasi: Firebase Console → **Project Settings** (ikon ⚙️) → scroll ke bawah → bagian **"Your apps"**

### 5. Jalankan Aplikasi

Karena menggunakan Firebase SDK via CDN, kamu bisa langsung membuka file dengan **web server lokal**:

**Opsi A — VS Code Live Server (direkomendasikan):**
1. Install ekstensi **Live Server** di VS Code
2. Klik kanan `index.html` → **"Open with Live Server"**

**Opsi B — Python HTTP Server:**
```bash
cd All-in-One-App
python3 -m http.server 8080
# Buka http://localhost:8080
```

**Opsi C — Node.js serve:**
```bash
npx serve .
```

> ⚠️ **Jangan buka `index.html` langsung** lewat `file://` di browser — Firebase tidak bekerja dengan protokol `file://`. Selalu gunakan web server lokal.

---

## 🔒 Firestore Security Rules (untuk Production)

Ganti rules di Firebase Console → **Firestore → Rules** sebelum deploy:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users dapat baca/tulis profil mereka sendiri
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Notes hanya bisa diakses pemiliknya
    match /notes/{docId} {
      allow read, write: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }

    // Todos hanya bisa diakses pemiliknya
    match /todos/{docId} {
      allow read, write: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }

    // Journey hanya bisa diakses pemiliknya
    match /journey/{docId} {
      allow read, write: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
  }
}
```

---

## 🗺️ Fitur Perjalanan (GPS)

Fitur ini menggunakan **Leaflet.js** (open-source, gratis, tanpa API key) dengan data peta dari OpenStreetMap.

**Cara penggunaan:**
1. Klik menu **Perjalanan Saya**
2. Klik tombol **"Rekam Lokasi Sekarang"**
3. Izinkan akses lokasi di browser
4. Beri label tempat → **Simpan**
5. Titik muncul di peta dan timeline secara otomatis

---

## 📦 Teknologi yang Digunakan

| Library/Service | Versi | Fungsi |
|---|---|---|
| Firebase Auth | 9.23.0 | Autentikasi pengguna |
| Firebase Firestore | 9.23.0 | Database real-time |
| Leaflet.js | 1.9.4 | Peta interaktif (gratis) |
| Lucide Icons | Latest | Ikon UI |
| Google Fonts (Inter) | – | Tipografi |

---

## 🛠️ Pengembangan Lanjutan

Beberapa ide pengembangan selanjutnya:
- **Firebase Storage** untuk upload foto profil
- **Push Notifications** dengan Firebase Cloud Messaging
- **PWA** (Progressive Web App) agar bisa di-install di HP
- **Export data** ke PDF atau Excel
- **Sharing catatan** antar pengguna
- **Dark mode**

---

## 📝 Lisensi

MIT License — bebas digunakan untuk keperluan pribadi maupun komersial.
