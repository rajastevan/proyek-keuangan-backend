// routes/laporan.js (VERSI BARU UNTUK POSTGRES)
const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint Cerdas: Menghitung saldo awal sebuah akun sebelum tanggal tertentu
router.get('/saldo-awal', async (req, res) => {
    const { akunId, tanggal } = req.query;
    if (!akunId || !tanggal) {
        return res.status(400).json({ message: 'Parameter akunId dan tanggal dibutuhkan.' });
    }

    try {
        // Query ini mengambil saldo awal akun, lalu menjumlahkan/mengurangkan
        // semua transaksi SEBELUM tanggal yang diminta untuk mendapatkan saldo awal periode.
        // Diubah: Placeholder '?' menjadi '$1', '$2' dan cara baca hasil query
        const query = `
            SELECT
                a.saldo_awal + COALESCE(SUM(CASE WHEN t.tipe = 'pemasukan' THEN t.jumlah ELSE -t.jumlah END), 0) AS saldo_awal_periode
            FROM akun a
            LEFT JOIN transaksi t ON a.id = t.id_akun AND t.tanggal < $1
            WHERE a.id = $2
            GROUP BY a.id, a.saldo_awal;
        `;
        const { rows } = await db.query(query, [tanggal, akunId]);

        if (rows.length === 0) {
            // Jika tidak ada transaksi sama sekali, ambil saja saldo awal dari akun
            const { rows: akunRows } = await db.query('SELECT saldo_awal FROM akun WHERE id = $1', [akunId]);
            if (akunRows.length > 0) {
                return res.status(200).json({ saldo_awal: parseFloat(akunRows[0].saldo_awal) });
            }
            return res.status(404).json({ message: 'Akun tidak ditemukan.' });
        }

        res.status(200).json({ saldo_awal: parseFloat(rows[0].saldo_awal_periode) });
    } catch (error) {
        console.error('Error saat menghitung saldo awal:', error);
        res.status(500).json({ message: 'Gagal menghitung saldo awal.', error: error.message });
    }
});

module.exports = router;