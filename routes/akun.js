// routes/akun.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint GET - Mengambil semua akun (Tetap Sama)
router.get('/', async (req, res) => {
    try {
        const query = 'SELECT id, nama_akun, saldo_saat_ini FROM akun ORDER BY nama_akun ASC';
        const [results] = await db.query(query);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error saat mengambil akun:', error);
        res.status(500).json({ message: 'Gagal mengambil data akun', error: error.message });
    }
});

// Endpoint POST - Membuat akun baru (Tetap Sama)
router.post('/', async (req, res) => {
    const { nama_akun, saldo_awal } = req.body;
    if (!nama_akun) {
        return res.status(400).json({ message: 'Nama akun tidak boleh kosong' });
    }
    const saldo = saldo_awal ? parseFloat(saldo_awal) : 0;
    try {
        // Perhatikan $1, $2, $3 sebagai placeholder dan RETURNING id
        const query = 'INSERT INTO akun (nama_akun, saldo_awal, saldo_saat_ini) VALUES ($1, $2, $3) RETURNING id';
        const results = await db.query(query, [nama_akun, saldo, saldo]);
        res.status(201).json({ message: 'Akun berhasil dibuat!', id: results.rows[0].id });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Nama akun sudah ada.', error: error.message });
        }
        console.error('Error saat membuat akun:', error);
        res.status(500).json({ message: 'Gagal membuat akun baru', error: error.message });
    }
});

// --- PERUBAHAN MULAI DARI SINI ---

// Endpoint BARU: PUT /:id - Mengubah nama akun
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nama_akun } = req.body; // Hanya nama yang bisa diubah

    if (!nama_akun) {
        return res.status(400).json({ message: 'Nama akun tidak boleh kosong.' });
    }
    try {
        const query = 'UPDATE akun SET nama_akun = ? WHERE id = ?';
        await db.query(query, [nama_akun, id]);
        res.status(200).json({ message: 'Nama akun berhasil diperbarui!' });
    } catch (error) {
         if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Nama akun tersebut sudah digunakan.', error: error.message });
        }
        console.error('Error saat update akun:', error);
        res.status(500).json({ message: 'Gagal memperbarui akun.', error: error.message });
    }
});

// Endpoint BARU: DELETE /:id - Menghapus akun
// PERINGATAN: Ini akan menghapus semua transaksi yang terkait dengan akun ini!
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Cek dulu apakah akun punya saldo. Sebaiknya akun dikosongkan dulu.
        const [rows] = await db.query('SELECT saldo_saat_ini FROM akun WHERE id = ?', [id]);
        if (rows.length > 0 && parseFloat(rows[0].saldo_saat_ini) !== 0) {
             // return res.status(400).json({ message: 'Akun tidak dapat dihapus karena saldo belum nol.' });
        }

        const query = 'DELETE FROM akun WHERE id = ?';
        await db.query(query, [id]);
        res.status(200).json({ message: 'Akun dan semua transaksinya berhasil dihapus.' });
    } catch (error) {
        console.error('Error saat menghapus akun:', error);
        res.status(500).json({ message: 'Gagal menghapus akun.', error: error.message });
    }
});

// Endpoint GET - Menghitung total saldo (Tetap Sama)
router.get('/total-saldo', async (req, res) => {
    try {
        const query = 'SELECT SUM(saldo_saat_ini) AS total_saldo FROM akun';
        const [results] = await db.query(query);
        const totalSaldo = results[0].total_saldo || 0;
        res.status(200).json({ total_saldo: totalSaldo });
    } catch (error) {
        console.error('Error saat mengambil total saldo:', error);
        res.status(500).json({ message: 'Gagal mengambil total saldo', error: error.message });
    }
});

module.exports = router;