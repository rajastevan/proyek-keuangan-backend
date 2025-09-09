// routes/transaksi.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint GET - Mengambil SEMUA transaksi, SEKARANG BISA FILTER KATEGORI & TANGGAL
router.get('/', async (req, res) => {
    const { tanggal_mulai, tanggal_akhir, id_kategori } = req.query;

    let query = `
        SELECT
            t.id, t.tanggal, t.keterangan, t.jumlah, t.tipe,
            a.nama_akun, k.nama_kategori, t.id_akun, t.id_kategori
        FROM transaksi t
        LEFT JOIN akun a ON t.id_akun = a.id
        LEFT JOIN kategori k ON t.id_kategori = k.id
    `;
    const params = [];
    let conditions = [];

    // Filter berdasarkan tanggal
    if (tanggal_mulai && tanggal_akhir) {
        conditions.push('t.tanggal BETWEEN ? AND ?');
        params.push(tanggal_mulai, `${tanggal_akhir} 23:59:59`);
    }

    // Filter berdasarkan kategori (bisa lebih dari satu)
    if (id_kategori) {
        // Ubah string "1,2,3" menjadi array [1, 2, 3]
        const kategoriIds = id_kategori.split(',').map(id => parseInt(id.trim(), 10));
        if (kategoriIds.length > 0) {
            conditions.push(`t.id_kategori IN (?)`);
            params.push(kategoriIds);
        }
    }

    // Gabungkan semua kondisi filter
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY t.tanggal DESC, t.id DESC';

    try {
        const [results] = await db.query(query, params);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error saat mengambil semua transaksi:', error);
        res.status(500).json({ message: 'Gagal mengambil data transaksi', error: error.message });
    }
});

// Endpoint 2: GET - Mengambil semua transaksi untuk SATU AKUN SPESIFIK
// :idAkun adalah parameter dinamis yang akan kita ambil dari URL
router.get('/akun/:id', async (req, res) => {
    const { id } = req.params;
    const { tanggal_mulai, tanggal_akhir, id_kategori } = req.query;

    let query = `
        SELECT
            t.id, t.id_akun, t.id_kategori, t.tanggal, t.keterangan, t.jumlah, t.tipe,
            k.nama_kategori
        FROM transaksi t
        LEFT JOIN kategori k ON t.id_kategori = k.id
    `;
    const params = [];
    let conditions = ['t.id_akun = ?']; // Filter by akun ID is always active
    params.push(id);

    // Filter tambahan berdasarkan tanggal
    if (tanggal_mulai && tanggal_akhir) {
        conditions.push('t.tanggal BETWEEN ? AND ?');
        params.push(tanggal_mulai, `${tanggal_akhir} 23:59:59`);
    }

    // Filter tambahan berdasarkan kategori
    if (id_kategori) {
        const kategoriIds = id_kategori.split(',').map(id => parseInt(id.trim(), 10));
        if (kategoriIds.length > 0) {
            conditions.push(`t.id_kategori IN (?)`);
            params.push(kategoriIds);
        }
    }

    query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.tanggal DESC, t.id DESC';

    try {
        const [results] = await db.query(query, params);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error saat mengambil transaksi per akun:', error);
        res.status(500).json({ message: 'Gagal mengambil data transaksi', error: error.message });
    }
});


// Endpoint 3: POST - Membuat transaksi baru (INI BAGIAN UTAMANYA)
router.post('/', async (req, res) => {
    // Ambil semua data yang dibutuhkan dari body
    const { id_akun, id_kategori, tanggal, keterangan, jumlah, tipe } = req.body;

    // Validasi input dasar
    if (!id_akun || !jumlah || !tipe || !tanggal) {
        return res.status(400).json({ message: 'Input tidak lengkap: id_akun, jumlah, tipe, dan tanggal wajib diisi.' });
    }

    // Dapatkan satu koneksi dari pool untuk memulai transaction
    const connection = await db.getConnection();

    try {
        // --- MULAI TRANSACTION ---
        await connection.beginTransaction();

        // 1. Insert data ke tabel 'transaksi'
        const transaksiQuery = 'INSERT INTO transaksi (id_akun, id_kategori, tanggal, keterangan, jumlah, tipe) VALUES (?, ?, ?, ?, ?, ?)';
        await connection.query(transaksiQuery, [id_akun, id_kategori, tanggal, keterangan, jumlah, tipe]);

        // 2. Update 'saldo_saat_ini' di tabel 'akun'
        // Tentukan apakah jumlah akan ditambah atau dikurang dari saldo
        const jumlahUpdate = tipe === 'pemasukan' ? parseFloat(jumlah) : -parseFloat(jumlah);
        
        const akunQuery = 'UPDATE akun SET saldo_saat_ini = saldo_saat_ini + ? WHERE id = ?';
        await connection.query(akunQuery, [jumlahUpdate, id_akun]);

        // Jika semua query berhasil, commit transaction
        await connection.commit();
        // --- TRANSACTION SELESAI ---

        res.status(201).json({ message: 'Transaksi berhasil dibuat!' });

    } catch (error) {
        // Jika terjadi error, batalkan semua perubahan
        await connection.rollback();
        console.error('Error saat membuat transaksi:', error);
        res.status(500).json({ message: 'Gagal membuat transaksi, semua perubahan dibatalkan.', error: error.message });
    } finally {
        // Penting! Kembalikan koneksi ke pool setelah selesai
        connection.release();
    }
});


// routes/transaksi.js (lanjutan...)

// Endpoint 4: DELETE - Menghapus transaksi
router.delete('/:id', async (req, res) => {
    const { id } = req.params; // Ambil ID transaksi dari URL
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Ambil dulu detail transaksi yang akan dihapus (kita butuh id_akun dan jumlahnya)
        const [rows] = await connection.query('SELECT * FROM transaksi WHERE id = ?', [id]);
        if (rows.length === 0) {
            throw new Error('Transaksi tidak ditemukan.');
        }
        const trxToDelete = rows[0];

        // 2. Hapus transaksi dari tabel 'transaksi'
        await connection.query('DELETE FROM transaksi WHERE id = ?', [id]);

        // 3. Kembalikan saldo di tabel 'akun'
        // Logikanya dibalik: jika itu pemasukan, kita kurangi saldonya. jika pengeluaran, kita tambah saldonya.
        const jumlahUpdate = trxToDelete.tipe === 'pemasukan' ? -parseFloat(trxToDelete.jumlah) : parseFloat(trxToDelete.jumlah);

        const akunQuery = 'UPDATE akun SET saldo_saat_ini = saldo_saat_ini + ? WHERE id = ?';
        await connection.query(akunQuery, [jumlahUpdate, trxToDelete.id_akun]);

        // Jika semua berhasil, commit
        await connection.commit();

        res.status(200).json({ message: 'Transaksi berhasil dihapus!' });

    } catch (error) {
        // Jika gagal, batalkan semua
        await connection.rollback();
        console.error('Error saat menghapus transaksi:', error);
        res.status(500).json({ message: 'Gagal menghapus transaksi.', error: error.message });
    } finally {
        // Selalu kembalikan koneksi
        connection.release();
    }
});

// routes/transaksi.js (lanjutan...)

// Endpoint 5: PUT - Mengubah/mengedit transaksi
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { id_akun, id_kategori, tanggal, keterangan, jumlah, tipe } = req.body;

    if (!id_akun || !jumlah || !tipe || !tanggal) {
        return res.status(400).json({ message: 'Input tidak lengkap.' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Ambil data transaksi LAMA sebelum diubah
        const [rows] = await connection.query('SELECT * FROM transaksi WHERE id = ?', [id]);
        if (rows.length === 0) {
            throw new Error('Transaksi tidak ditemukan.');
        }
        const trxLama = rows[0];

        // 2. Batalkan efek transaksi LAMA pada saldo akunnya
        const jumlahBatal = trxLama.tipe === 'pemasukan' ? -parseFloat(trxLama.jumlah) : parseFloat(trxLama.jumlah);
        await connection.query('UPDATE akun SET saldo_saat_ini = saldo_saat_ini + ? WHERE id = ?', [jumlahBatal, trxLama.id_akun]);

        // 3. Update data transaksi di tabel 'transaksi' dengan data BARU
        const updateQuery = 'UPDATE transaksi SET id_akun = ?, id_kategori = ?, tanggal = ?, keterangan = ?, jumlah = ?, tipe = ? WHERE id = ?';
        await connection.query(updateQuery, [id_akun, id_kategori, tanggal, keterangan, jumlah, tipe, id]);

        // 4. Terapkan efek transaksi BARU pada saldo akunnya (bisa jadi akun yang sama atau berbeda)
        const jumlahBaru = tipe === 'pemasukan' ? parseFloat(jumlah) : -parseFloat(jumlah);
        await connection.query('UPDATE akun SET saldo_saat_ini = saldo_saat_ini + ? WHERE id = ?', [jumlahBaru, id_akun]);

        await connection.commit();
        res.status(200).json({ message: 'Transaksi berhasil diperbarui!' });

    } catch (error) {
        await connection.rollback();
        console.error('Error saat update transaksi:', error);
        res.status(500).json({ message: 'Gagal memperbarui transaksi.', error: error.message });
    } finally {
        connection.release();
    }
});


// Endpoint BARU: GET - Mendapatkan ringkasan pemasukan & pengeluaran bulan ini
router.get('/ringkasan/bulan-ini', async (req, res) => {
    try {
        const query = `
            SELECT
                tipe,
                SUM(jumlah) AS total
            FROM transaksi
            WHERE
                MONTH(tanggal) = MONTH(CURRENT_DATE()) AND
                YEAR(tanggal) = YEAR(CURRENT_DATE())
            GROUP BY tipe;
        `;
        const [results] = await db.query(query);

        // Proses hasilnya menjadi format yang mudah dipakai
        const ringkasan = {
            pemasukan: 0,
            pengeluaran: 0
        };

        results.forEach(row => {
            if (row.tipe === 'pemasukan') {
                ringkasan.pemasukan = parseFloat(row.total);
            } else if (row.tipe === 'pengeluaran') {
                ringkasan.pengeluaran = parseFloat(row.total);
            }
        });

        res.status(200).json(ringkasan);
    } catch (error) {
        console.error('Error saat mengambil ringkasan bulanan:', error);
        res.status(500).json({ message: 'Gagal mengambil ringkasan', error: error.message });
    }
});

// Endpoint BARU: GET - Laporan pengeluaran per kategori bulan ini
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
                MONTH(t.tanggal) = MONTH(CURRENT_DATE()) AND
                YEAR(t.tanggal) = YEAR(CURRENT_DATE())
            GROUP BY k.nama_kategori
            HAVING total > 0
            ORDER BY total DESC;
        `;
        const [results] = await db.query(query);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error saat mengambil laporan pengeluaran:', error);
        res.status(500).json({ message: 'Gagal mengambil laporan', error: error.message });
    }
});

module.exports = router;