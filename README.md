# TapeFlow // DECK-90

Pemutar musik web bertema kaset retro. Satu kaset, satu deck, lengkap dengan display teks berjalan, lirik live, dan efek suara analog.

## Fitur

- **Satu kaset saja.** Saat dibuka, kaset kosong keluar dari deck dan display menulis `NO MUSIC PLAYED`.
- **Rak kaset.** Semua file audio di folder `songs/` otomatis menjadi kaset. Kaset baru bisa ditambah dari file lokal atau link.
- **Display.** Menampilkan `PENYANYI — JUDUL`. Teks yang panjang otomatis menjadi running text.
- **Live lyrics.** Lirik tersinkron dicari otomatis dari [LRCLIB](https://lrclib.net), atau pakai file `.lrc` sendiri.
- **Efek analog.** Slider TRACK, RAIN FX, TAPE HISS, dan WARMTH, plus VU meter kiri/kanan.
- **Penyimpanan.** Kaset yang ditambah lewat web tersimpan di browser (IndexedDB) dan tetap ada setelah refresh.

## Struktur folder

```
retro/
├── index.html
├── css/style.css
├── js/
│   ├── app.js       # logika utama: deck, rak, lirik, penyimpanan
│   ├── audio.js     # mesin audio (Web Audio API)
│   ├── visual.js    # VU meter, reel, counter
│   └── lyrics.js    # pencarian dan parser lirik (LRC)
└── songs/           # taruh file audio di sini
```

## Cara menjalankan

Aplikasi ini harus dibuka lewat server lokal. Kalau `index.html` diklik langsung, lagu di folder `songs/` tidak akan terbaca.

Pilih salah satu:

- **Python:** jalankan `python -m http.server 8000` di dalam folder `retro`, lalu buka `http://localhost:8000`.
- **VS Code:** pasang ekstensi *Live Server*, klik kanan `index.html`, pilih *Open with Live Server*.

Pencarian lirik membutuhkan koneksi internet.

## Menambah lagu

### Cara 1: lewat folder (permanen)

Taruh file audio (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.aac`, `.flac`) di folder `songs/`. Kasetnya muncul di rak tanpa perlu mengubah kode, dan rak diperbarui setiap kali dibuka.

Beri nama file dengan pola `Penyanyi - Judul.mp3` supaya penyanyi dan judulnya terbaca benar. Ini penting untuk pencarian lirik.

Fitur ini membutuhkan server yang menampilkan daftar isi folder (Python `http.server` dan Live Server biasanya bisa). Kalau hosting-mu menyembunyikan isi folder, buat file `songs/songs.json` berisi daftar nama file:

```json
["Penyanyi - Judul.mp3", "Lagu Lain.mp3"]
```

### Cara 2: lewat web

Buka **RAK**, lalu di bagian *Tambah kaset baru*:

1. Isi **Penyanyi** dan **Judul** (disarankan, supaya lirik akurat).
2. Pilih **FILE** lokal, atau tempel link di kolom link.
3. Klik **MASUKKAN KASET**.

Kaset hasil tambahan diberi label `TERSIMPAN`. Hapus dengan tombol ✕ di pojok kaset (kaset yang sedang di dalam deck harus di-EJECT dulu).

Jenis link yang didukung:

| Jenis link | Keterangan |
|---|---|
| Link langsung ke file audio (`.mp3`, dll.) | Server asal harus mengizinkan CORS. Filenya ikut disimpan di browser. |
| Video YouTube | Diputar lewat player resmi YouTube. |
| Lagu (track) Spotify | Diputar lewat player resmi Spotify. Playlist dan album belum didukung. |

## Kontrol

| Tombol | Fungsi | Pintasan |
|---|---|---|
| PLAY | Memutar kaset (kalau belum ada kaset, membuka rak) | `Space` |
| STOP | Berhenti | `S` atau `Space` |
| RAK | Membuka rak kaset | `L` |
| EJECT | Mengeluarkan kaset lalu membuka rak | `E` |
| REW / FF | Hanya animasi, belum menggeser posisi lagu | `R` / `F` |
| Geser lirik | Memajukan atau memundurkan lirik 0,5 detik | `]` / `[` |

## Lirik

- Lirik dicari otomatis berdasarkan penyanyi dan judul, lalu disimpan di browser.
- Kalau tidak ditemukan, klik **Load .lrc** untuk memakai file lirik sendiri. File itu ikut tersimpan di kaset yang tersimpan.
- Kalau lirik terasa terlalu cepat atau lambat (misalnya karena versi lagu berbeda), geser dengan `[` dan `]`.

## Batasan

- **YouTube dan Spotify** diputar lewat player resmi mereka. Slider mixer tidak memengaruhi suaranya, FF/REW dinonaktifkan, dan gerak VU meter hanya simulasi. Spotify tanpa login biasanya hanya memutar cuplikan 30 detik.
- **Penyimpanan browser** hanya berlaku di browser dan perangkat yang sama, dan hilang kalau data browser dibersihkan. Untuk lagu jangka panjang, taruh file di folder `songs/`.
- **Lirik** bisa meleset atau tidak ditemukan untuk lagu yang kurang dikenal.

## Sumber lagu yang legal

- **Gratis:** [Free Music Archive](https://freemusicarchive.org), [Jamendo](https://www.jamendo.com), [Internet Archive](https://archive.org), [Bandcamp](https://bandcamp.com) (sebagian artis), Pixabay Music, ccMixter.
- **Lagu populer:** beli file-nya, misalnya di iTunes Store, toko musik digital Amazon, atau Bandcamp.

Cek lisensi tiap lagu sebelum dipakai. Hindari situs konverter YouTube ke MP3 karena melanggar hak cipta dan aturan YouTube.

## Pemecahan masalah

| Masalah | Penyebab dan solusi |
|---|---|
| Rak hanya berisi 4 lagu bawaan | Server tidak menampilkan isi folder. Buat `songs/songs.json`. |
| Lagu tidak bunyi saat dibuka dari file | Jalankan lewat server lokal (lihat *Cara menjalankan*). |
| `Gagal membuka audio` saat memasukkan link | Server link tidak mengizinkan CORS. Unduh filenya dan tambahkan sebagai file lokal. |
| Lirik tidak ketemu | Periksa penulisan penyanyi dan judul, atau pakai file `.lrc`. |
| YouTube atau Spotify tidak langsung bunyi | Browser memblokir autoplay. Tekan PLAY sekali. |