const multer = require('multer');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } = require('../services/pdfService');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type (${file.mimetype}). Please upload a JPG, PNG, WEBP, or PDF document.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 10 MB limit
    files: 10, // Up to 10 photos/files at once (e.g. multi-shot camera)
  },
  fileFilter,
});

module.exports = upload;
