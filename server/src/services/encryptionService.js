const crypto = require('crypto');

/**
 * AES-256-GCM Encryption Service
 * Encrypts confidential medical files prior to GridFS persistence.
 * Uses a 256-bit key from environment, a unique 96-bit (12-byte) initialization vector (IV) per file,
 * and produces a 128-bit (16-byte) authentication tag to guarantee ciphertext integrity and authenticity.
 */

const getEncryptionKey = () => {
  const keyHex = process.env.FILE_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('FILE_ENCRYPTION_KEY is not defined in server environment variables.');
  }

  // Key can be 64-char hex string (32 bytes) or raw 32-char utf-8 string
  let keyBuffer;
  if (keyHex.length === 64) {
    keyBuffer = Buffer.from(keyHex, 'hex');
  } else {
    keyBuffer = Buffer.from(keyHex, 'utf8');
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `FILE_ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Current length: ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
};

/**
 * Encrypt a plaintext Buffer with AES-256-GCM
 * @param {Buffer} buffer - Plaintext file buffer
 * @returns {{ encryptedBuffer: Buffer, iv: string, authTag: string }}
 */
const encrypt = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Data to encrypt must be a Buffer.');
  }

  const key = getEncryptionKey();
  // 12 bytes IV is standard for AES-GCM
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
};

/**
 * Decrypt a ciphertext Buffer with AES-256-GCM and verify its authentication tag
 * @param {Buffer} encryptedBuffer - Ciphertext buffer
 * @param {string} ivHex - Hex encoded 12-byte initialization vector
 * @param {string} authTagHex - Hex encoded 16-byte authentication tag
 * @returns {Buffer} Decrypted plaintext buffer
 */
const decrypt = (encryptedBuffer, ivHex, authTagHex) => {
  if (!Buffer.isBuffer(encryptedBuffer)) {
    throw new TypeError('Encrypted data must be a Buffer.');
  }
  if (!ivHex || !authTagHex) {
    throw new Error('Missing initialization vector (IV) or authentication tag.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);
    return decryptedBuffer;
  } catch (error) {
    throw new Error(
      'Decryption failed. The file may have been tampered with or corrupted.'
    );
  }
};

module.exports = {
  encrypt,
  decrypt,
};
