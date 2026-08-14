# Vibecode API

Backend starter menggunakan Bun, ElysiaJS, Drizzle ORM, dan MySQL.

## Menjalankan Project

1. Install dependency dengan `bun install`.
2. Salin `.env.example` menjadi `.env`, lalu sesuaikan `DATABASE_URL`.
3. Jalankan migrasi dengan `bun run db:generate` dan `bun run db:migrate`.
4. Jalankan development server dengan `bun run dev`.

Server tersedia di `http://localhost:3000`. Gunakan `GET /health` untuk memeriksa aplikasi dan `GET /health/database` untuk memeriksa koneksi MySQL.

## Registrasi User

Gunakan `POST /api/users` untuk mendaftarkan user baru:

```json
{
  "name": "daffa",
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

Email disimpan dalam lowercase dan harus unik. Password disimpan sebagai hash bcrypt, bukan plaintext. Email yang sudah terdaftar menghasilkan status `409`, sedangkan request yang tidak valid menghasilkan status `422`.

## Integration Test

Siapkan `DATABASE_URL_TEST` yang menunjuk ke database MySQL khusus test, lalu jalankan `bun test`. Integration test dilewati jika variable tersebut tidak tersedia dan akan berhenti jika nilainya sama dengan `DATABASE_URL` untuk mencegah perubahan pada database development.

Database test harus berbeda dari database development karena migration dan pembersihan tabel `users` dijalankan selama test.

## Script

- `bun run dev`: menjalankan server dengan watch mode.
- `bun run start`: menjalankan server.
- `bun run typecheck`: memeriksa tipe TypeScript.
- `bun test`: menjalankan test.
- `bun run db:generate`: membuat file migrasi dari schema Drizzle.
- `bun run db:migrate`: menjalankan migrasi ke MySQL.
- `bun run db:studio`: membuka Drizzle Studio.
