import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import fs from 'fs/promises';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({ dest: path.join(__dirname, 'uploads') });

const formatters: { [key: string]: (data: string) => string } = {
  text: (d) => d,
  url: (d) => (d.startsWith('http') ? d : `http://${d}`),
  email: (d) => `mailto:${d}`,
  phone: (d) => `tel:${d}`,
  sms: (d) => `smsto:${d}`,
  wifi: (d) => {
    const [ssid, password] = d.split(':');
    return `WIFI:T:WPA;S:${ssid};P:${password};;`;
  },
  image: (url) => url,
};

app.use(express.urlencoded({ extended: true }));

app.get('/', async (req: Request, res: Response) => {
  try {
    const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
    res.send(html.replace('{{qrImage}}', ''));
  } catch {
    res.status(500).send('Failed to load page');
  }
});

app.post('/qr/generate', upload.single('imagefile'), async (req: Request, res: Response) => {
  const type = String(req.body.type || '').toLowerCase();
  const width = parseInt(req.body.width) || 400;

  if (!formatters[type]) {
    return res.status(400).send('Invalid QR type.');
  }

  try {
    let content = '';

    if (type === 'image') {
      if (!req.file) {
        return res.status(400).send('No image uploaded.');
      }

      const inputPath = req.file.path;
      const outputPath = inputPath;

        await sharp(inputPath).toFile(outputPath);

      content = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    } else {
      content = formatters[type](req.body.data || '');
    }

    const qrDataUrl = await QRCode.toDataURL(content, {
      errorCorrectionLevel: 'H',
      width,
      margin: 2,
    });

    let html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
    html = html.replace('{{qrImage}}', `<h2>Generated QR Code:</h2><img src="${qrDataUrl}" alt="QR Code" />`);
    res.send(html);
  } catch {
    res.status(400).send('Error generating QR code.');
  }
});

app.listen(port, () => {
  console.log(`QR Generator running at http://localhost:${port}`);
});
