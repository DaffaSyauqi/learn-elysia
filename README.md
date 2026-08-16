# Vibecode API

Vibecode API adalah backend REST sederhana untuk manajemen user dan autentikasi
berbasis session. Project ini menyediakan alur registrasi, login, melihat profil
user yang sedang login, dan logout dengan token UUID yang disimpan di database.

API dibangun sebagai project TypeScript yang berjalan di Bun. Elysia menangani
routing HTTP, service layer menangani logika bisnis, dan Drizzle ORM mengakses
database MySQL.

## Fitur

- Health check aplikasi dan koneksi database.
- Registrasi user baru dengan validasi input dan email unik.
- Hash password menggunakan bcrypt sebelum disimpan.
- Login dengan verifikasi password dan pembuatan session token UUID.
- Pengambilan profil user menggunakan `Authorization: Bearer <token>`.
- Logout dengan menghapus session token dari database.
- Dokumentasi API interaktif menggunakan Swagger UI.
- Unit test untuk route dan service.
- Integration test untuk alur database jika `DATABASE_URL_TEST` tersedia.

## Arsitektur

Project menggunakan pembagian tanggung jawab sederhana:

```text
HTTP request
    |
    v
routes/       Validasi request, parsing header, response, HTTP status
    |
    v
services/     Logika bisnis user, password, dan session
    |
    v
db/           Drizzle schema, connection pool, dan query database
    |
    v
MySQL
```

Route tidak mengandung query database langsung. Route memvalidasi input,
memanggil service, lalu mengubah hasil atau domain error menjadi response HTTP.
Service bertanggung jawab terhadap aturan bisnis seperti normalisasi email,
hash password, pembuatan token, pencarian session, dan penghapusan session.

## Struktur Folder

```text
.
├── drizzle/                  Migration database dan metadata Drizzle
├── src/
│   ├── app.ts                Komposisi aplikasi dan registrasi route
│   ├── config.ts             Konfigurasi port dan database URL
│   ├── index.ts              Entry point dan HTTP server
│   ├── db/
│   │   ├── client.ts         Connection pool dan instance Drizzle
│   │   └── schema.ts         Definisi tabel users dan session
│   ├── routes/
│   │   ├── health.ts         Endpoint health check
│   │   └── users-route.ts     Endpoint registrasi, login, profil, logout
│   └── services/
│       └── users-service.ts  Logika bisnis user dan session
├── test/
│   ├── app.test.ts            Test aplikasi dasar
│   ├── users-route.test.ts    Unit test route user
│   ├── users-service.test.ts  Unit test service user
│   └── users-integration.test.ts
│                               Integration test dengan MySQL
├── .env.example              Template environment variable
├── drizzle.config.ts         Konfigurasi Drizzle Kit
├── package.json              Script dan dependency project
├── tsconfig.json              Konfigurasi TypeScript
└── bun.lock                  Lockfile dependency Bun
```

### Konvensi Penamaan File

- File TypeScript menggunakan ekstensi `.ts`.
- Nama file menggunakan lowercase kebab-case, misalnya `users-route.ts`.
- File route fitur menggunakan suffix `-route.ts`, misalnya `users-route.ts`.
  Route kecil yang berdiri sendiri dapat memakai nama domain langsung, seperti
  `health.ts`.
- File service menggunakan suffix `-service.ts`, misalnya
  `users-service.ts`.
- File test menggunakan nama file yang diuji dan suffix `.test.ts`, misalnya
  `users-route.test.ts`.
- Nama tabel database menggunakan snake_case, misalnya `created_at` dan
  `user_id`.
- Nama properti TypeScript mengikuti camelCase, misalnya `createdAt` dan
  `userId`. Response API memetakan field timestamp menjadi `created_at` sesuai
  kontrak API.

### Tanggung Jawab File Utama

- `src/index.ts`: menjalankan server pada port dari `PORT`.
- `src/app.ts`: membuat instance Elysia, mengonfigurasi plugin OpenAPI, dan
  memasang route.
- `src/routes/health.ts`: menyediakan `GET /health` dan
  `GET /health/database`.
- `src/routes/users-route.ts`: menyediakan endpoint user, validasi payload,
  parsing Bearer token, dan mapping response.
- `src/services/users-service.ts`: registrasi, login, pencarian profil dari
  session, logout, hash password, dan domain error.
- `src/db/schema.ts`: sumber kebenaran schema database dalam Drizzle.
- `src/db/client.ts`: membuat pool MySQL dan instance Drizzle.
- `drizzle/`: migration yang dihasilkan dari schema.

## Schema Database

### Tabel `users`

| Kolom | Tipe | Ketentuan |
| --- | --- | --- |
| `id` | `INT` | Primary key, auto increment |
| `name` | `VARCHAR(255)` | Not null |
| `email` | `VARCHAR(255)` | Not null, unique |
| `password` | `VARCHAR(255)` | Not null, berisi bcrypt hash |
| `created_at` | `TIMESTAMP` | Not null, default waktu saat ini |

### Tabel `session`

| Kolom | Tipe | Ketentuan |
| --- | --- | --- |
| `id` | `INT` | Primary key, auto increment |
| `token` | `VARCHAR(255)` | Not null, unique, berisi UUID |
| `user_id` | `INT` | Not null, foreign key ke `users.id` |
| `created_at` | `TIMESTAMP` | Not null, default waktu saat ini |

Relasi dan constraint:

- `users.email` memiliki unique constraint agar satu email hanya terdaftar satu
  kali.
- `session.token` memiliki unique constraint.
- `session.user_id` memiliki index untuk pencarian berdasarkan user.
- `session.user_id` mereferensikan `users.id`.
- Penghapusan user menghapus session terkait melalui `ON DELETE CASCADE`.
- Satu user dapat memiliki beberapa session aktif dari login yang berbeda.
- Logout menghapus hanya session yang tokennya dikirim oleh client.

Alur autentikasi:

1. Registrasi menyimpan user dan bcrypt hash password.
2. Login memverifikasi password lalu membuat UUID baru.
3. UUID disimpan di `session.token` bersama `session.user_id`.
4. Client mengirim token pada header `Authorization` untuk endpoint yang
   membutuhkan autentikasi.
5. Logout menghapus row session berdasarkan token tersebut.

## API Endpoint

Base URL lokal: `http://localhost:3000`

### Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

```http
GET /health/database
```

Endpoint ini memeriksa koneksi MySQL. Response `200` berisi `{"status":"ok"}`
dan response `503` berisi `{"status":"unavailable"}` jika database tidak
dapat diakses.

### Registrasi

```http
POST /api/users
Content-Type: application/json
```

```json
{
  "name": "Daffa",
  "email": "daffa@gmail.com",
  "password": "123"
}
```

Response berhasil:

```json
{
  "statusCode": 200,
  "data": "OK"
}
```

Email di-trim dan dinormalisasi menjadi lowercase. Password tidak pernah
disimpan sebagai plaintext. Email duplikat menghasilkan `409`, sedangkan
payload tidak valid menghasilkan `422`.

### Login

```http
POST /api/users/login
Content-Type: application/json
```

```json
{
  "email": "daffa@gmail.com",
  "password": "123"
}
```

Response berhasil:

```json
{
  "statusCode": 200,
  "data": "550e8400-e29b-41d4-a716-446655440000"
}
```

Nilai `data` adalah token UUID dari tabel `session`. Simpan token secara aman
dan kirimkan sebagai Bearer token. Kredensial salah menghasilkan `401`, dan
payload tidak valid menghasilkan `422`.

### Profil User

```http
GET /api/users/me
Authorization: Bearer <token>
```

Response berhasil:

```json
{
  "statusCode": 200,
  "data": {
    "id": 1,
    "name": "Daffa",
    "email": "daffa@gmail.com",
    "created_at": "2026-08-16T10:00:00.000Z"
  }
}
```

Token tidak ditemukan, kosong, atau memiliki format header yang salah
menghasilkan `401 Unauthorized`.

### Logout

```http
DELETE /api/users/logout
Authorization: Bearer <token>
```

Response berhasil:

```json
{
  "statusCode": 200,
  "data": "OK"
}
```

Logout menghapus session dari database. Token yang sama tidak dapat digunakan
kembali dan menghasilkan `401 Unauthorized` jika dikirim lagi. Error server
yang tidak terduga menghasilkan `500`.

Response unauthorized:

```json
{
  "statusCode": 401,
  "error": "Unauthorized"
}
```

## Tech Stack dan Library

- **Bun**: JavaScript runtime, package manager, development server, dan test
  runner.
- **TypeScript**: static typing untuk source code.
- **Elysia**: framework HTTP untuk routing, request validation, dan application
  composition.
- **@elysia/openapi**: plugin OpenAPI dan dokumentasi API interaktif.
- **Drizzle ORM**: type-safe query builder dan definisi schema database.
- **Drizzle Kit**: generate, menjalankan, dan mengelola migration.
- **MySQL**: database relasional untuk data user dan session.
- **mysql2**: driver koneksi MySQL yang digunakan oleh Drizzle.
- **Bun password API**: hashing dan verifikasi password dengan bcrypt.

Dependency runtime berada di `dependencies`, sedangkan tooling TypeScript,
Bun types, dan Drizzle Kit berada di `devDependencies`.

## API Documentation

Project menggunakan plugin `@elysia/openapi` untuk menghasilkan dokumentasi API
interaktif berbasis OpenAPI. Dokumentasi menggunakan provider Swagger UI.

Akses dokumentasi saat server berjalan:

```text
Swagger UI:
http://localhost:3000/openapi

Raw OpenAPI JSON:
http://localhost:3000/openapi/json
```

Dokumentasi menampilkan seluruh endpoint, request body, response, dan
pengelompokan berdasarkan tags. Endpoint yang membutuhkan autentikasi ditandai
dengan security scheme `bearerAuth`.

Gunakan tombol `Authorize` pada Swagger UI untuk memasukkan session token.
Isi token tanpa awalan `Bearer`, lalu Swagger UI akan mengirimkan:

```http
Authorization: Bearer <token>
```

Token diperoleh dari response endpoint login:

```http
POST /api/users/login
```

## Prasyarat

- Bun versi terbaru yang kompatibel dengan project.
- MySQL yang sedang berjalan.
- Database MySQL yang dapat diakses oleh aplikasi.

Periksa instalasi Bun:

```bash
bun --version
```

## Setup Project

### 1. Install Dependency

```bash
bun install
```

### 2. Siapkan Database

Buat database MySQL, misalnya `vibecode`, lalu buat file `.env` dari template:

```bash
cp .env.example .env
```

Sesuaikan nilai environment variable:

```env
PORT=3000
DATABASE_URL=mysql://app:password@localhost:3306/vibecode
```

`DATABASE_URL` digunakan oleh aplikasi dan Drizzle Kit. File `.env` tidak boleh
di-commit karena dapat berisi kredensial database.

### 3. Jalankan Migration

Migration sudah tersedia di folder `drizzle/`. Untuk menerapkannya ke database:

```bash
bun run db:migrate
```

Jika schema di `src/db/schema.ts` berubah, generate migration baru lalu tinjau
file SQL yang dihasilkan:

```bash
bun run db:generate
bun run db:migrate
```

Drizzle Kit membutuhkan `DATABASE_URL` saat command database dijalankan.

### 4. Jalankan Development Server

```bash
bun run dev
```

Server berjalan di `http://localhost:3000` secara default. Port dapat diubah
melalui `PORT`. Endpoint `GET /health` dapat digunakan untuk memastikan server
berjalan.

### 5. Jalankan Production-like Server

```bash
bun run start
```

Command ini menjalankan `src/index.ts` tanpa watch mode.

## Script Project

| Command | Kegunaan |
| --- | --- |
| `bun run dev` | Menjalankan server dengan watch mode |
| `bun run start` | Menjalankan server tanpa watch mode |
| `bun run typecheck` | Memeriksa tipe TypeScript tanpa emit file |
| `bun test` | Menjalankan seluruh test dengan Bun |
| `bun run db:generate` | Membuat migration dari perubahan schema |
| `bun run db:migrate` | Menerapkan migration ke database MySQL |
| `bun run db:studio` | Membuka Drizzle Studio |

## Testing

### Unit Test

Unit test route dan service dapat dijalankan tanpa database:

```bash
bun test test/app.test.ts test/users-route.test.ts test/users-service.test.ts
```

Test route memeriksa validasi payload, normalisasi input, header Bearer, status
HTTP, dan bentuk response. Test service memeriksa hash password, login,
pembuatan session, pengambilan profil, logout, dan pemetaan error database.

### Integration Test

Integration test membutuhkan database MySQL khusus test. Jangan gunakan database
development atau production karena test akan menjalankan migration dan
membersihkan tabel `users` serta `session`.

Tambahkan variable berikut ke environment shell atau file environment yang
digunakan saat test:

```env
DATABASE_URL_TEST=mysql://app:password@localhost:3306/vibecode_test
```

Pastikan `DATABASE_URL_TEST` berbeda dari `DATABASE_URL`, lalu jalankan:

```bash
bun test test/users-integration.test.ts
```

Jika `DATABASE_URL_TEST` tidak tersedia, integration test otomatis di-skip.
Jika nilainya sama dengan `DATABASE_URL`, test akan berhenti untuk mencegah
database development terhapus.

### Verifikasi Lengkap

Sebelum membuat perubahan atau pull request, jalankan:

```bash
bun run typecheck
bun test
```

Integration test yang aktif ikut dijalankan oleh `bun test`. Pastikan output
menunjukkan `0 fail`. Jumlah test yang di-skip dapat berbeda tergantung apakah
`DATABASE_URL_TEST` tersedia.

## Pengembangan

Saat menambahkan fitur baru:

1. Tambahkan atau ubah schema di `src/db/schema.ts` jika ada perubahan database.
2. Generate dan tinjau migration Drizzle.
3. Letakkan endpoint dan validasi request di `src/routes/`.
4. Letakkan aturan bisnis dan akses data di `src/services/`.
5. Tambahkan unit test route dan service.
6. Tambahkan integration test untuk alur yang menyentuh MySQL.
7. Jalankan typecheck dan seluruh test sebelum membuat pull request.

Pertahankan pemisahan route dan service agar validasi HTTP tidak bercampur dengan
logika bisnis atau query database.
