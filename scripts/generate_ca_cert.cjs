const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const qzCertPath = path.join(__dirname, '..', 'src', 'lib', 'qz_cert.ts');
const txt = fs.readFileSync(qzCertPath, 'utf8');

// Extract private key
const startMarker = '-----BEGIN RSA PRIVATE KEY-----';
const endMarker = '-----END RSA PRIVATE KEY-----';
const startIdx = txt.indexOf(startMarker);
const endIdx = txt.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Private key not found in qz_cert.ts');
  process.exit(1);
}

const pkeyRaw = txt.substring(startIdx, endIdx + endMarker.length);
const pkeyPem = pkeyRaw.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n');
const privateKey = forge.pki.privateKeyFromPem(pkeyPem);
const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);

// Create CA certificate
const cert = forge.pki.createCertificate();
cert.publicKey = publicKey;
cert.serialNumber = '01' + Date.now().toString(16);
cert.validity.notBefore = new Date();
cert.validity.notBefore.setDate(cert.validity.notBefore.getDate() - 1); // yesterday
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 25); // 25 years

const attrs = [
  { name: 'commonName', value: 'HousePublique' },
  { name: 'organizationName', value: 'HousePublique' },
  { name: 'countryName', value: 'ES' }
];
cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([
  {
    name: 'basicConstraints',
    cA: true,
    critical: true
  },
  {
    name: 'keyUsage',
    keyCertSign: true,
    cRLSign: true,
    digitalSignature: true,
    critical: true
  },
  {
    name: 'subjectKeyIdentifier'
  }
]);

// Sign certificate with private key
cert.sign(privateKey, forge.md.sha256.create());
const certPem = forge.pki.certificateToPem(cert);

console.log('--- NUEVO CERTIFICADO CA GENERADO CON EXITO ---');

// Format for qz_cert.ts
const escapedCert = certPem.replace(/\r\n/g, '\\r\\n').replace(/\n/g, '\\r\\n');
const escapedKey = pkeyPem.trim().replace(/\r\n/g, '\\r\\n').replace(/\n/g, '\\r\\n');

const newTsContent = `export const QZ_CERTIFICATE = "${escapedCert}";\r\nexport const QZ_PRIVATE_KEY = "${escapedKey}";\r\n`;

fs.writeFileSync(qzCertPath, newTsContent, 'utf8');
console.log('✅ Actualizado src/lib/qz_cert.ts');

// Prepare override_combined.crt
const demoCertPath = 'C:\\Program Files\\QZ Tray\\override.crt';
let demoCert = '';
if (fs.existsSync(demoCertPath)) {
  const currentOverride = fs.readFileSync(demoCertPath, 'utf8');
  const demoEnd = currentOverride.indexOf('-----END CERTIFICATE-----');
  if (demoEnd !== -1) {
    demoCert = currentOverride.substring(0, demoEnd + 25).trim();
  }
}

const overrideContent = (demoCert ? demoCert + '\r\n\r\n' : '') + certPem.trim() + '\r\n';
const overrideFilePath = path.join(__dirname, 'override_combined.crt');
fs.writeFileSync(overrideFilePath, overrideContent, 'utf8');
console.log('✅ Generado scripts/override_combined.crt con extensiones CA:TRUE');
