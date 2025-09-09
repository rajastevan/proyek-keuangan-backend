// routes/kategori.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint GET - Mengambil semua kategori (Bisa filter by tipe)
router.get('/', async (req, res) => {
    const { tipe } = req.query;
    let query = 'SELECT * FROM kategori';
    const params = [];

    if (tipe) {
        query += ' WHERE tipe = ?';
        params.push(tipe);
    }
    query += ' ORDER BY nama_kategori ASC';

    try {
        const [results] = await db.query(query, params);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error saat mengambil kategori:', error);
        res.status(500).json({ message: 'Gagal mengambil data kategori', error: error.message });
    }
});

// Endpoint POST - Membuat kategori baru
router.post('/', async (req, res) => {
    const { nama_kategori, tipe } = req.body;
    if (!nama_kategori || !tipe) {
        return res.status(400).json({ message: 'Nama kategori dan tipe tidak boleh kosong' });
    }
    try {
        const query = 'INSERT INTO kategori (nama_kategori, tipe) VALUES ($1, $2) RETURNING id';
        const results = await db.query(query, [nama_kategori, tipe]);
        res.status(201).json({ message: 'Kategori berhasil dibuat!', id: results.rows[0].id });
    } catch (error) {
        // ... (Error handling tetap sama)
    }
});

// --- ENDPOINT BARU MULAI DI SINI ---

// Endpoint PUT /:id - Mengubah/mengedit kategori
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nama_kategori, tipe } = req.body;

    if (!nama_kategori || !tipe) {
        return res.status(400).json({ message: 'Input tidak lengkap.' });
    }
    try {
        const query = 'UPDATE kategori SET nama_kategori = ?, tipe = ? WHERE id = ?';
        await db.query(query, [nama_kategori, tipe, id]);
        res.status(200).json({ message: 'Kategori berhasil diperbarui!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Nama kategori tersebut sudah digunakan.' });
        }
        console.error('Error saat update kategori:', error);
        res.status(500).json({ message: 'Gagal memperbarui kategori.' });
    }
});

// Endpoint DELETE /:id - Menghapus kategori
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        // 1. Set id_kategori di transaksi menjadi NULL agar data transaksi tidak hilang
        await connection.query('UPDATE transaksi SET id_kategori = NULL WHERE id_kategori = ?', [id]);
        // 2. Baru hapus kategorinya
        await connection.query('DELETE FROM kategori WHERE id = ?', [id]);
        await connection.commit();
        res.status(200).json({ message: 'Kategori berhasil dihapus.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error saat menghapus kategori:', error);
        res.status(500).json({ message: 'Gagal menghapus kategori.' });
    } finally {
        connection.release();
    }
});


module.exports = router;