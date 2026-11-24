const mongoose = require('mongoose');
const { getGridFSBucket } = require('../config/db');

/**
 * GridFS Storage Service
 * Encapsulates upload, streaming retrieval, and deletion of encrypted medical file payloads in MongoDB GridFS.
 */

/**
 * Upload an encrypted buffer to GridFS
 * @param {Buffer} encryptedBuffer - AES-256-GCM encrypted payload
 * @param {string} originalName - Original file name
 * @param {object} metadata - Encryption metadata (iv, authTag, mimeType, etc.)
 * @returns {Promise<mongoose.Types.ObjectId>} GridFS file ID
 */
const uploadEncryptedFile = (encryptedBuffer, originalName, metadata = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(originalName, {
        metadata: {
          ...metadata,
          encrypted: true,
          uploadedAt: new Date(),
        },
      });

      uploadStream.on('error', (err) => {
        reject(new Error(`Failed to upload file to GridFS: ${err.message}`));
      });

      uploadStream.on('finish', () => {
        resolve(uploadStream.id);
      });

      uploadStream.end(encryptedBuffer);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Download an encrypted buffer from GridFS along with its encryption metadata
 * @param {mongoose.Types.ObjectId|string} gridFsId
 * @returns {Promise<{ encryptedBuffer: Buffer, metadata: object, filename: string }>}
 */
const downloadEncryptedFile = async (gridFsId) => {
  const bucket = getGridFSBucket();
  const objectId =
    typeof gridFsId === 'string'
      ? new mongoose.Types.ObjectId(gridFsId)
      : gridFsId;

  // Retrieve file metadata document
  const files = await bucket.find({ _id: objectId }).toArray();
  if (!files || files.length === 0) {
    throw new Error('Requested file was not found in storage.');
  }

  const fileDoc = files[0];

  return new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(objectId);
    const chunks = [];

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', (err) => {
      reject(new Error(`Failed to read file from GridFS: ${err.message}`));
    });

    downloadStream.on('end', () => {
      const encryptedBuffer = Buffer.concat(chunks);
      resolve({
        encryptedBuffer,
        metadata: fileDoc.metadata || {},
        filename: fileDoc.filename,
      });
    });
  });
};

/**
 * Delete a file and its chunks from GridFS
 * @param {mongoose.Types.ObjectId|string} gridFsId
 */
const deleteFile = async (gridFsId) => {
  try {
    const bucket = getGridFSBucket();
    const objectId =
      typeof gridFsId === 'string'
        ? new mongoose.Types.ObjectId(gridFsId)
        : gridFsId;

    await bucket.delete(objectId);
  } catch (err) {
    // Ignore if already deleted
    if (!err.message.includes('FileNotFound')) {
      throw err;
    }
  }
};

module.exports = {
  uploadEncryptedFile,
  downloadEncryptedFile,
  deleteFile,
};
