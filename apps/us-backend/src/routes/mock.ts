import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';

function resolveRoot(): string {
  const custom = process.env.TEST_DATA_DIR?.trim();
  if (custom) return custom;
  return process.cwd();
}

async function readFileSafe(filePath: string) {
  try {
    const data = await fs.readFile(filePath);
    return { ok: true as const, data };
  } catch (err) {
    return { ok: false as const, err };
  }
}

export default function mockRoutes() {
  const router = Router();

  router.get('/orders/:id', async (req, res) => {
    const id = req.params.id;
    const root = resolveRoot();

    const candidates = [
      path.join(root, 'reports', `order_${id}_detailed_report.json`),
      path.join(root, `order_${id}_detailed_report.json`),
    ];

    for (const p of candidates) {
      const r = await readFileSafe(p);
      if (r.ok) {
        res.type('application/json').send(r.data);
        return;
      }
    }

    res.status(404).json({ code: 'NOT_FOUND', message: 'order detailed report not found', id });
  });

  router.get('/evidence/:dir/:file', async (req, res) => {
    const { dir, file } = req.params;
    const root = resolveRoot();
    const evidencePath = path.join(root, 'reports', 'evidence', dir, file);
    const r = await readFileSafe(evidencePath);
    if (!r.ok) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'evidence file not found', dir, file });
      return;
    }

    const ext = path.extname(file).toLowerCase();
    if (ext === '.json') {
      res.type('application/json').send(r.data);
    } else if (ext === '.csv') {
      res.type('text/csv').send(r.data);
    } else {
      res.type('text/plain').send(r.data);
    }
  });

  return router;
}