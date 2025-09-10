// routes/akun.js (VERSI BARU UNTUK POSTGRES)
const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint GET - Mengambil semua akun
router.get('/', async (req, res) => {
    try {
        const query = 'SELECT id, nama_akun, saldo_saat_ini FROM akun ORDER BY nama_akun ASC';
        // Diubah: Cara membaca hasil query untuk pg
        const { rows } = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error saat mengambil akun:', error);
        res.status(500).json({ message: 'Gagal mengambil data akun', error: error.message });
    }
});

// Endpoint POST - Membuat akun baru
router.post('/', async (req, res) => {
    const { nama_akun, saldo_awal } = req.body;
    if (!nama_akun) {
        return res.status(400).json({ message: 'Nama akun tidak boleh kosong' });
    }
    const saldo = saldo_awal ? parseFloat(saldo_awal) : 0;
    try {
        // Diubah: Placeholder '?' menjadi '$1, $2, ...'
        const query = 'INSERT INTO akun (nama_akun, saldo_awal, saldo_saat_ini) VALUES ($1, $2, $3) RETURNING id';
        const { rows } = await db.query(query, [nama_akun, saldo, saldo]);
        res.status(201).json({ message: 'Akun berhasil dibuat!', id: rows[0].id });
    } catch (error) {
        // Diubah: Kode error duplicate entry untuk Postgres adalah '23505'
        if (error.code === '23505') { 
            return res.status(409).json({ message: 'Nama akun sudah ada.', error: error.message });
        }
        console.error('Error saat membuat akun:', error);
        res.status(500).json({ message: 'Gagal membuat akun baru', error: error.message });
    }
});

// Endpoint PUT /:id - Mengubah nama akun
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nama_akun } = req.body;

    if (!nama_akun) {
        return res.status(400).json({ message: 'Nama akun tidak boleh kosong.' });
    }
    try {
        // Diubah: Placeholder '?' menjadi '$1, $2'
        const query = 'UPDATE akun SET nama_akun = $1 WHERE id = $2';
        await db.query(query, [nama_akun, id]);
        res.status(200).json({ message: 'Nama akun berhasil diperbarui!' });
    } catch (error) {
        // Diubah: Kode error duplicate entry untuk Postgres adalah '23505'
         if (error.code === '23505') {
            return res.status(409).json({ message: 'Nama akun tersebut sudah digunakan.', error: error.message });
        }
        console.error('Error saat update akun:', error);
        res.status(500).json({ message: 'Gagal memperbarui akun.', error: error.message });
    }
});

// Endpoint DELETE /:id - Menghapus akun
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // PERINGATAN: Di Postgres, foreign key constraint akan mencegah penghapusan
        // jika masih ada transaksi yang terkait. Ini perilaku yang lebih aman.
        // Frontend harus memastikan semua transaksi sudah dipindahkan/dihapus dulu.
        
        // Diubah: Placeholder '?' menjadi '$1' dan cara baca hasil query
        const { rows } = await db.query('SELECT saldo_saat_ini FROM akun WHERE id = $1', [id]);
        if (rows.length > 0 && parseFloat(rows[0].saldo_saat_ini) !== 0) {
             // Sebaiknya logika ini ditangani di frontend untuk pengalaman pengguna yang lebih baik
             // return res.status(400).json({ message: 'Akun tidak dapat dihapus karena saldo belum nol.' });
        }

        const query = 'DELETE FROM akun WHERE id = $1';
        await db.query(query, [id]);
        res.status(200).json({ message: 'Akun berhasil dihapus.' });
    } catch (error) {
        // Tangani error jika akun masih punya transaksi terkait
        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({ message: 'Gagal hapus: Akun ini masih memiliki transaksi terkait.' });
        }
        console.error('Error saat menghapus akun:', error);
        res.status(500).json({ message: 'Gagal menghapus akun.', error: error.message });
    }
});

// Endpoint GET - Menghitung total saldo
router.get('/total-saldo', async (req, res) => {
    try {
        const query = 'SELECT SUM(saldo_saat_ini) AS total_saldo FROM akun';
        // Diubah: Cara membaca hasil query untuk pg
        const { rows } = await db.query(query);
        const totalSaldo = rows[0].total_saldo || 0;
        res.status(200).json({ total_saldo: parseFloat(totalSaldo) });
    } catch (error) {
        console.error('Error saat mengambil total saldo:', error);
        res.status(500).json({ message: 'Gagal mengambil total saldo', error: error.message });
    }
});

module.exports = router;