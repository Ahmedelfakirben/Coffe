const fs = require('fs');
const path = require('path');

try {
  const qzCertPath = path.join(__dirname, '..', 'src', 'lib', 'qz_cert.ts');
  const content = fs.readFileSync(qzCertPath, 'utf8');

  // Extract certificate string
  const startIdx = content.indexOf('-----BEGIN CERTIFICATE-----');
  const endMarker = '-----END CERTIFICATE-----';
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.error('Certificate markers not found in qz_cert.ts');
    process.exit(1);
  }

  const rawCert = content.substring(startIdx, endIdx + endMarker.length);
  // Unescape \r\n if written as literal characters
  const cleanCert = rawCert.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n');

  // 1. Write to AppData/qz/override.crt
  const appDataDir = path.join(process.env.APPDATA, 'qz');
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  const appDataFile = path.join(appDataDir, 'override.crt');
  fs.writeFileSync(appDataFile, cleanCert.trim() + '\r\n');
  console.log('✅ Certificado guardado en AppData:', appDataFile);

  // 2. Try Program Files
  const progFilesFile = 'C:\\Program Files\\QZ Tray\\override.crt';
  try {
    fs.writeFileSync(progFilesFile, cleanCert.trim() + '\r\n');
    console.log('✅ Certificado guardado en Program Files:', progFilesFile);
  } catch (err) {
    console.log('ℹ️ Para Program Files se requiere permisos de Administrador:', err.message);
  }
} catch (e) {
  console.error('Error:', e);
}
