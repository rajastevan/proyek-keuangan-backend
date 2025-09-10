// routes/transaksi.js (VERSI BARU UNTUK POSTGRES)
const express = require('express');
const router = express.Router();
const db = require('../db');

// --- PENTING: Semua query di file ini diubah untuk Postgres ---

// Endpoint GET - Mengambil SEMUA transaksi
router.get('/', async (req, res) => {
    const { tanggal_mulai, tanggal_akhir, id_kategori } = req.query;

    let baseQuery = `
        SELECT
            t.id, t.tanggal, t.keterangan, t.jumlah, t.tipe,
            a.nama_akun, k.nama_kategori, t.id_akun, t.id_kategori
        FROM transaksi t
        LEFT JOIN akun a ON t.id_akun = a.id
        LEFT JOIN kategori k ON t.id_kategori = k.id
    `;
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (tanggal_mulai && tanggal_akhir) {
        conditions.push(`t.tanggal BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(tanggal_mulai, `${tanggal_akhir} 23:59:59`);
    }

    if (id_kategori) {
        const kategoriIds = id_kategori.split(',').map(id => parseInt(id.trim(), 10));
        if (kategoriIds.length > 0) {
            const placeholders = kategoriIds.map(() => `$${paramIndex++}`).join(',');
            conditions.push(`t.id_kategori IN (${placeholders})`);
            params.push(...kategoriIds);
        }
    }

    if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    baseQuery += ' ORDER BY t.tanggal DESC, t.id DESC';

    try {
        const { rows } = await db.query(baseQuery, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error saat mengambil semua transaksi:', error);
        res.status(500).json({ message: 'Gagal mengambil data transaksi', error: error.message });
    }
});

// Endpoint GET - Mengambil semua transaksi untuk SATU AKUN SPESIFIK
router.get('/akun/:id', async (req, res) => {
    const { id } = req.params;
    const { tanggal_mulai, tanggal_akhir, id_kategori } = req.query;

    let baseQuery = `
        SELECT
            t.id, t.id_akun, t.id_kategori, t.tanggal, t.keterangan, t.jumlah, t.tipe,
            k.nama_kategori
        FROM transaksi t
        LEFT JOIN kategori k ON t.id_kategori = k.id
    `;
    
    const conditions = [`t.id_akun = $1`];
    const params = [id];
    let paramIndex = 2; // Mulai dari $2 karena $1 sudah dipakai

    if (tanggal_mulai && tanggal_akhir) {
        conditions.push(`t.tanggal BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(tanggal_mulai, `${tanggal_akhir} 23:59:59`);
    }

    if (id_kategori) {
        const kategoriIds = id_kategori.split(',').map(id => parseInt(id.trim(), 10));
        if (kategoriIds.length > 0) {
            const placeholders = kategoriIds.map(() => `$${paramIndex++}`).join(',');
            conditions.push(`t.id_kategori IN (${placeholders})`);
            params.push(...kategoriIds);
        }
    }

    baseQuery += ' WHERE ' + conditions.join(' AND ');
    baseQuery += ' ORDER BY t.tanggal DESC, t.id DESC';

    try {
        const { rows } = await db.query(baseQuery, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error saat mengambil transaksi per akun:', error);
        res.status(500).json({ message: 'Gagal mengambil data transaksi', error: error.message });
    }
});

// --- LOGIKA TRANSAKSI DIUBAH TOTAL UNTUK POSTGRES ---
// Kita akan menggunakan 'client' dari pool untuk menangani transaksi

// Endpoint POST - Membuat transaksi baru
router.post('/', async (req, res) => {
    const { id_akun, id_kategori, tanggal, keterangan, jumlah, tipe } = req.body;
    if (!id_akun || !jumlah || !tipe || !tanggal) {
        return res.status(400).json({ message: 'Input tidak lengkap.' });
    }

    const client = await db.getClient(); // Ambil satu koneksi client dari pool

    try {
        await client.query('BEGIN'); // Mulai transaksi

        const transaksiQuery = 'INSERT INTO transaksi (id_akun, id_kategori, tanggal, keterangan, jumlah, tipe) VALUES ($1, $2, $3, $4, $5, $6)';
        await client.query(transaksiQuery, [id_akun, id_kategori, tanggal, keterangan, jumlah, tipe]);

        const jumlahUpdate = tipe === 'pemasukan' ? parseFloat(jumlah) : -parseFloat(jumlah);
        const akunQuery = 'UPDATE akun SET saldo_saat_ini = saldo_saat_ini + $1 WHERE id = $2';
        await client.query(akunQuery, [jumlahUpdate, id_akun]);

        await client.query('COMMIT'); // Selesaikan transaksi jika semua berhasil
        res.status(201).json({ message: 'Transaksi berhasil dibuat!' });
    } catch (error) {
        await client.query('ROLLBACK'); // Batalkan semua jika ada error
        console.error('Error saat membuat transaksi:', error);
        res.status(500).json({ message: 'Gagal membuat transaksi, semua perubahan dibatalkan.', error: error.message });
    } finally {
        client.release(); // PENTING! Kembalikan client ke pool
    }
});

// Endpoint DELETE - Menghapus transaksi
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { rows } = await client.query('SELECT * FROM transaksi WHERE id = $1', [id]);
        if (rows.length === 0) {
            throw new Error('Transaksi tidak ditemukan.');
        }
        const trxToDelete = rows[0];

        await client.query('DELETE FROM transaksi WHERE id = $1', [id]);

        const jumlahUpdate = trxToDelete.tipe === 'pemasukan' ? -parseFloat(trxToDelete.jumlah) : parseFloat(trxToDelete.jumlah);
        const akunQuery = 'UPDATE akun SET saldo_saat_ini = saldo_saat_ini + $1 WHERE id = $2';
        await client.query(akunQuery, [jumlahUpdate, trxToDelete.id_akun]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Transaksi berhasil dihapus!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saat menghapus transaksi:', error);
        res.status(500).json({ message: 'Gagal menghapus transaksi.', error: error.message });
    } finally {
        client.release();
    }
});

// Endpoint PUT - Mengubah/mengedit transaksi
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { id_akun, id_kategori, tanggal, keterangan, jumlah, tipe } = req.body;
    if (!id_akun || !jumlah || !tipe || !tanggal) {
        return res.status(400).json({ message: 'Input tidak lengkap.' });
    }

    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { rows } = await client.query('SELECT * FROM transaksi WHERE id = $1', [id]);
        if (rows.length === 0) {
            throw new Error('Transaksi tidak ditemukan.');
        }
        const trxLama = rows[0];

        const jumlahBatal = trxLama.tipe === 'pemasukan' ? -parseFloat(trxLama.jumlah) : parseFloat(trxLama.jumlah);
        await client.query('UPDATE akun SET saldo_saat_ini = saldo_saat_ini + $1 WHERE id = $2', [jumlahBatal, trxLama.id_akun]);
        
        const updateQuery = 'UPDATE transaksi SET id_akun = $1, id_kategori = $2, tanggal = $3, keterangan = $4, jumlah = $5, tipe = $6 WHERE id = $7';
        await client.query(updateQuery, [id_akun, id_kategori, tanggal, keterangan, jumlah, tipe, id]);

        const jumlahBaru = tipe === 'pemasukan' ? parseFloat(jumlah) : -parseFloat(jumlah);
        await client.query('UPDATE akun SET saldo_saat_ini = saldo_saat_ini + $1 WHERE id = $2', [jumlahBaru, id_akun]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Transaksi berhasil diperbarui!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saat update transaksi:', error);
        res.status(500).json({ message: 'Gagal memperbarui transaksi.', error: error.message });
    } finally {
        client.release();
    }
});


// --- FUNGSI TANGGAL DIUBAH DARI MONTH()/YEAR() MENJADI EXTRACT() UNTUK POSTGRES ---

// Endpoint GET - Mendapatkan ringkasan pemasukan & pengeluaran bulan ini
router.get('/ringkasan/bulan-ini', async (req, res) => {
    try {
        const query = `
            SELECT
                tipe,
                SUM(jumlah) AS total
            FROM transaksi
            WHERE
                EXTRACT(MONTH FROM tanggal) = EXTRACT(MONTH FROM CURRENT_DATE) AND
                EXTRACT(YEAR FROM tanggal) = EXTRACT(YEAR FROM CURRENT_DATE)
            GROUP BY tipe;
        `;
        const { rows } = await db.query(query);

        const ringkasan = { pemasukan: 0, pengeluaran: 0 };
        rows.forEach(row => {
            if (row.tipe === 'pemasukan') {
                ringkasan.pemasukan = parseFloat(row.total) || 0;
            } else if (row.tipe === 'pengeluaran') {
                ringkasan.pengeluaran = parseFloat(row.total) || 0;
            }
        });

        res.status(200).json(ringkasan);
    } catch (error) {
        console.error('Error saat mengambil ringkasan bulanan:', error);
        res.status(500).json({ message: 'Gagal mengambil ringkasan', error: error.message });
    }
});

// Endpoint GET - Laporan pengeluaran per kategori bulan ini
router.get('/laporan/pengeluaran-by-kategori', async (req, res) => {
    try {
        const query = `
            SELECT
                k.nama_kategori,
                SUM(t.jumlah) AS total
            FROM transaksi t
            JOIN kategori k ON t.id_kategori = k.id
            WHERE
                t.tipe = 'pengeluaran' AND
                EXTRACT(MONTH FROM t.tanggal) = EXTRACT(MONTH FROM CURRENT_DATE) AND
                EXTRACT(YEAR FROM t.tanggal) = EXTRACT(YEAR FROM CURRENT_DATE)
            GROUP BY k.nama_kategori
            HAVING SUM(t.jumlah) > 0
            ORDER BY total DESC;
        `;
        const { rows } = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error saat mengambil laporan pengeluaran:', error);
        res.status(500).json({ message: 'Gagal mengambil laporan', error: error.message });
    }
});

module.exports = router;