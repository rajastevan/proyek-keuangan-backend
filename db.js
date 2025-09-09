// db.js
const mysql = require('mysql2');

// Membuat connection pool, lebih efisien daripada createConnection biasa
// karena bisa mengelola beberapa koneksi sekaligus.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // TAMBAHKAN BARIS INI UNTUK KONEKSI DI RENDER
    ssl: {
        rejectUnauthorized: false
    }
});

// Menggunakan .promise() agar bisa memakai async/await (syntax modern)
// daripada callback (syntax lama).
module.exports = pool.promise();