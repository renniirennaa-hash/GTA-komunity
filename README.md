# SAMP Community Hub (Real-time)

Website komunitas GTA SAMP yang **bisa dipakai banyak member** secara real-time.

## Fitur
- Login / Register (Firebase Auth)
- Share Modpack (tersimpan di Firestore, terlihat semua member)
- Chat Publik real-time
- Voice War via **Discord** (paling stabil & gratis)
- Edit Profil
- Status online member

---

## Cara Setup (Wajib)

### 1. Buat Firebase Project
1. Buka [https://console.firebase.google.com](https://console.firebase.google.com)
2. Klik **Create a project**
3. Setelah jadi, klik **Add app** → pilih **Web** (`</>`)
4. Copy konfigurasi firebaseConfig-nya

### 2. Aktifkan Authentication
1. Di Firebase Console → **Authentication** → **Get started**
2. Pilih **Email/Password** → Enable → Save

### 3. Buat Firestore Database
1. **Firestore Database** → **Create database**
2. Pilih **Start in test mode** (nanti bisa dikunci)
3. Pilih lokasi (pilih yang terdekat, misal `asia-southeast2`)

### 4. Atur Security Rules (penting)
Di tab **Rules**, ganti jadi:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /mods/{modId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorUid;
    }
    match /chat/{msgId} {
      allow read: if true;
      allow create: if request.auth != null;
    }
  }
}
```

Klik **Publish**.

### 5. Isi file `config.js`
Buka `config.js` lalu isi:

```js
firebase: {
  apiKey: "AIza...",
  authDomain: "nama-project.firebaseapp.com",
  projectId: "nama-project",
  storageBucket: "nama-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
},

discordInvite: "https://discord.gg/kode-invite-kamu"
```

### 6. Deploy ke GitHub Pages
1. Buat repository baru di GitHub
2. Upload semua file di folder ini
3. Masuk ke **Settings** → **Pages**
4. Source: **Deploy from a branch** → pilih `main` → folder `/ (root)`
5. Tunggu beberapa menit, website akan live di:
   `https://username.github.io/nama-repo`

---

## Catatan Voice
Voice chat real-time yang paling bagus & gratis untuk komunitas SAMP adalah **Discord**.

Cukup buat server Discord, buat channel voice (Main War, Faction A, Faction B, dll), lalu masukkan invite link-nya di `config.js`.

Kalau ingin voice langsung di dalam website (tanpa buka Discord), butuh layanan seperti Agora atau LiveKit (ada free tier tapi lebih ribet setupnya).

---

## Struktur File
```
├── index.html
├── styles.css
├── app.js
├── config.js      ← WAJIB diisi
└── README.md
```
