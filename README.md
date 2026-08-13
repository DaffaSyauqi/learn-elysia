# Vibecode API

Backend starter menggunakan Bun, ElysiaJS, Drizzle ORM, dan MySQL.

## Menjalankan Project

1. Install dependency dengan `bun install`.
2. Salin `.env.example` menjadi `.env`, lalu sesuaikan `DATABASE_URL`.
3. Jalankan migrasi dengan `bun run db:generate` dan `bun run db:migrate`.
4. Jalankan development server dengan `bun run dev`.

Server tersedia di `http://localhost:3000`. Gunakan `GET /health` untuk memeriksa aplikasi dan `GET /health/database` untuk memeriksa koneksi MySQL.

## Script

- `bun run dev`: menjalankan server dengan watch mode.
- `bun run start`: menjalankan server.
- `bun run typecheck`: memeriksa tipe TypeScript.
- `bun test`: menjalankan test.
- `bun run db:generate`: membuat file migrasi dari schema Drizzle.
- `bun run db:migrate`: menjalankan migrasi ke MySQL.
- `bun run db:studio`: membuka Drizzle Studio.
