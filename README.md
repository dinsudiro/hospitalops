# HospitalOps

HospitalOps mendukung operasional sales dan marketing rumah sakit. Halaman utama memakai Supabase Auth dan Database. Akses catatan dibatasi menurut keanggotaan organisasi. Pemilik bisa menambahkan UID akun Supabase sebagai Manager.

- Halaman utama: `index.html`.
- Demo dengan data simulasi dan penyimpanan browser: `demo.html`.
- Halaman untuk mengakses akun dan data Firebase sebelumnya: `firebase-legacy.html`.
- Skema Supabase untuk proyek baru: `hospitalops-schema.sql`. Migrasi ini sudah diterapkan pada proyek yang digunakan oleh situs.
- Impor menerima XLSX, XLS, CSV, DOCX, dan PDF teks. Preview memperlihatkan kolom yang dipetakan dan baris bermasalah. File mentah diproses di browser, dan catatan yang disetujui disimpan ke organisasi yang aktif.
- PKS/MoU menampilkan sisa hari serta riwayat perubahan dan perpanjangan.

Proyek Supabase perlu mengizinkan URL konfirmasi dan reset yang dipakai aplikasi, yaitu `https://dinsudiro.github.io/hospitalops/index.html` dan `https://dinsudiro.github.io/hospitalops/index.html?recovery=1`. Akun Firebase dan catatannya belum disalin ke Supabase.
