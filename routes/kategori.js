// routes/kategori.js (VERSI BARU UNTUK POSTGRES)
const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint GET - Mengambil semua kategori (Bisa filter by tipe)
router.get('/', async (req, res) => {
    const { tipe } = req.query;
    let query = 'SELECT * FROM kategori';
    const params = [];

    if (tipe) {
        // Diubah: Placeholder '?' menjadi '$1'
        query += ' WHERE tipe = $1';
        params.push(tipe);
    }
    query += ' ORDER BY nama_kategori ASC';

    try {
        // Diubah: Cara membaca hasil query untuk pg
        const { rows } = await db.query(query, params);
        res.status(200).json(rows);
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
        // Kode ini sudah benar untuk Postgres, tidak ada perubahan
        const query = 'INSERT INTO kategori (nama_kategori, tipe) VALUES ($1, $2) RETURNING id';
        const { rows } = await db.query(query, [nama_kategori, tipe]);
        res.status(201).json({ message: 'Kategori berhasil dibuat!', id: rows[0].id });
    } catch (error) {
        // Diubah: Kode error duplicate entry untuk Postgres adalah '23505'
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Nama kategori untuk tipe tersebut sudah ada.' });
        }
        console.error('Error saat membuat kategori:', error);
        res.status(500).json({ message: 'Gagal membuat kategori', error: error.message });
    }
});

// Endpoint PUT /:id - Mengubah/mengedit kategori
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nama_kategori, tipe } = req.body;

    if (!nama_kategori || !tipe) {
        return res.status(400).json({ message: 'Input tidak lengkap.' });
    }
    try {
        // Diubah: Placeholder '?' menjadi '$1, $2, ...'
        const query = 'UPDATE kategori SET nama_kategori = $1, tipe = $2 WHERE id = $3';
        await db.query(query, [nama_kategori, tipe, id]);
        res.status(200).json({ message: 'Kategori berhasil diperbarui!' });
    } catch (error) {
        // Diubah: Kode error duplicate entry untuk Postgres adalah '23505'
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Nama kategori tersebut sudah digunakan.' });
        }
        console.error('Error saat update kategori:', error);
        res.status(500).json({ message: 'Gagal memperbarui kategori.' });
    }
});

// Endpoint DELETE /:id - Menghapus kategori
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    // Diubah: Logika transaksi disesuaikan untuk pg
    const client = await db.getClient();

    try {
        await client.query('BEGIN');
        
        // 1. Set id_kategori di transaksi menjadi NULL agar data transaksi tidak hilang
        await client.query('UPDATE transaksi SET id_kategori = NULL WHERE id_kategori = $1', [id]);
        
        // 2. Baru hapus kategorinya
        await client.query('DELETE FROM kategori WHERE id = $1', [id]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Kategori berhasil dihapus.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saat menghapus kategori:', error);
        res.status(500).json({ message: 'Gagal menghapus kategori.' });
    } finally {
        client.release();
    }
});

module.exports = router;