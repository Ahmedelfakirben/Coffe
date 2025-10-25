// API Endpoint para subir backups a S3 de Hetzner
// Ejecutar con: node api/backup-to-s3.js
// O agregar a tu servidor Express existente

const http = require('http');
const https = require('https');
const crypto = require('crypto');

// Configuración S3 de Hetzner
const S3_CONFIG = {
  endpoint: 'fsn1.your-objectstorage.com',
  accessKey: process.env.S3_ACCESS_KEY || '0FIGEHTSRQYUALFOLUZS',
  secretKey: process.env.S3_SECRET_KEY || '3FTXkax7EXQ7MvzErV1HVxBBz4EDM4agcnpAAhrW',
  bucket: process.env.S3_BUCKET_NAME || 'coffee-shop-backups',
  region: process.env.S3_REGION || 'eu-central-1',
};

/**
 * Subir archivo a S3
 */
function uploadToS3(fileName, jsonContent) {
  return new Promise((resolve, reject) => {
    const path = `/${S3_CONFIG.bucket}/${fileName}`;
    const contentLength = Buffer.byteLength(jsonContent);
    const date = new Date().toUTCString();

    // Crear firma AWS v4
    const stringToSign = `PUT\n\napplication/json\n${date}\n${path}`;
    const signature = crypto
      .createHmac('sha1', S3_CONFIG.secretKey)
      .update(stringToSign)
      .digest('base64');

    const authorization = `AWS ${S3_CONFIG.accessKey}:${signature}`;

    const options = {
      hostname: S3_CONFIG.endpoint,
      port: 443,
      path: path,
      method: 'PUT',
      headers: {
        'Host': S3_CONFIG.endpoint,
        'Date': date,
        'Content-Type': 'application/json',
        'Content-Length': contentLength,
        'Authorization': authorization,
        'x-amz-acl': 'private',
      },
    };

    console.log('📤 Subiendo a S3...', { fileName, size: contentLength });

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          console.log('✅ Backup subido exitosamente');
          resolve({
            success: true,
            url: `https://${S3_CONFIG.endpoint}${path}`,
            statusCode: res.statusCode,
          });
        } else {
          console.error('❌ Error S3:', res.statusCode, data);
          reject(new Error(`Error S3: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error de red:', error);
      reject(error);
    });

    req.write(jsonContent);
    req.end();
  });
}

/**
 * Servidor HTTP para recibir peticiones de backup
 */
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/backup-to-s3') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { backupData, fileName } = JSON.parse(body);

        if (!backupData || !fileName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Faltan datos' }));
          return;
        }

        const jsonContent = JSON.stringify(backupData, null, 2);
        const result = await uploadToS3(fileName, jsonContent);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: error.message,
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Servidor de backup escuchando en http://localhost:${PORT}`);
  console.log(`📡 Endpoint: POST http://localhost:${PORT}/api/backup-to-s3`);
  console.log(`☁️  S3 Endpoint: ${S3_CONFIG.endpoint}`);
  console.log(`📦 Bucket: ${S3_CONFIG.bucket}`);
});
