// Membuat database (jika belum ada) dan semua tabel dari schema.sql.  Jalankan: npm run db:init
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { config } from './config.js';

const url = new URL(config.databaseUrl);
const namaDb = decodeURIComponent(url.pathname.slice(1));
if (!/^[A-Za-z0-9_]+$/.test(namaDb)) {
  console.error('Nama database di DATABASE_URL hanya boleh huruf, angka, dan underscore.');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  multipleStatements: true,
});
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${namaDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.query(`USE \`${namaDb}\``);
await conn.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
await conn.end();
console.log(`Database "${namaDb}" siap.`);
