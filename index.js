// index.js
require('dotenv').config();

const express = require('express');
const db = require('./db');
const cors = require('cors');

// Import routers
const kategoriRoutes = require('./routes/kategori');
const laporanRoutes = require('./routes/laporan');
const akunRoutes = require('./routes/akun');
const transaksiRoutes = require('./routes/transaksi'); // <-- BARIS BARU

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({ message: "Selamat datang di API Pencatatan Transaksi!" });
});

// Gunakan routers
app.use('/kategori', kategoriRoutes);
app.use('/laporan', laporanRoutes);
app.use('/akun', akunRoutes);
app.use('/transaksi', transaksiRoutes); // <-- BARIS BARU

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di port ${PORT}`);
});