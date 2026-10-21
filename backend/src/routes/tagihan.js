import { Router } from 'express';
import { wrap } from '../errors.js';
import { sinkronTagihan } from '../tagihan.js';

const router = Router();

// Tombol darurat: terbitkan tagihan bulanan yang terlewat sampai bulan berjalan. Aman dipanggil berulang.
router.post('/sinkron', wrap(async (req, res) => {
  res.json(await sinkronTagihan());
}));

export default router;
