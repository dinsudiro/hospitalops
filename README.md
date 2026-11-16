# HospitalOps

Ruang kerja sales dan marketing rumah sakit. Frontend statis dipublikasikan melalui GitHub Pages dari branch `main`. Firebase Authentication menggunakan email dan kata sandi. Data operasional disimpan di Cloud Firestore untuk masing-masing organisasi.

## Akses organisasi

1. Daftar akun, lalu pilih **Buat organisasi** untuk memulai workspace kosong.
2. Untuk menambahkan rekan, minta UID yang tampil pada halaman **Pilih organisasi** di akun reka​n. Pemilik workspace memasukkan UID tersebut dari tombol organisasi pada menu samping.
3. Rekan memilih **Akses organisasi tim** dan memasukkan ID organisasi. Pemilik dan Manager dapat menjalankan modul operasional. Pemberian akses Manager tersedia bagi pemilik.
4. Keluar dari akun melalui menu organisasi.

## Konfigurasi

- Firebase project `hospitalops-d9553`, Cloud Firestore Standard di Jakarta.
- Publikasikan `firestore.rules` pada database default setiap kali aturan berubah. Perubahan pada GitHub Pages hanya memublikasikan frontend.
- `firebase-config.js` berisi identitas publik Firebase Web SDK.
- Data contoh dan data Excel tidak diimpor. Pengiriman pengingat email otomatis belum tersedia.
