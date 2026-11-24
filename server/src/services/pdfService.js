const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validate that an uploaded file conforms to allowed medical document types and size limits
 * @param {Express.Multer.File} file
 */
const validateFile = (file) => {
  if (!file || !file.buffer) {
    throw new Error('No file provided for upload.');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    throw new Error(
      `Unsupported file format (${file.mimetype}). Please upload a JPG, PNG, WEBP, or PDF file.`
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds the 10 MB limit.');
  }
};

/**
 * Normalizes uploaded files (single PDF, single image, or multiple camera photos)
 * into a single unified standard PDF document.
 * - PDFs are validated and kept as is.
 * - Single/Multiple images (JPG, PNG, WEBP) are converted into high-fidelity PDF pages.
 *
 * @param {Express.Multer.File[]} files - Array of files from multer
 * @returns {Promise<{ pdfBuffer: Buffer, filename: string, pageCount: number }>}
 */
const normalizeToPdf = async (files) => {
  if (!files || files.length === 0) {
    throw new Error('At least one file or camera photo must be provided.');
  }

  // Validate each file first
  for (const file of files) {
    validateFile(file);
  }

  // Case 1: Single file that is already a PDF
  if (files.length === 1 && files[0].mimetype === 'application/pdf') {
    const file = files[0];
    const header = file.buffer.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF-')) {
      throw new Error('The uploaded PDF appears to be corrupted or invalid.');
    }

    const pdfDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();

    const baseName = file.originalname.replace(/\.[^/.]+$/, '');
    return {
      pdfBuffer: file.buffer,
      filename: `${baseName}.pdf`,
      pageCount,
    };
  }

  // Case 2: One or more images (JPG, PNG, WEBP) -> convert to multi-page PDF
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    if (file.mimetype === 'application/pdf') {
      // If mixing images and PDF, load pages from PDF
      const existingDoc = await PDFDocument.load(file.buffer);
      const copiedPages = await pdfDoc.copyPages(
        existingDoc,
        existingDoc.getPageIndices()
      );
      copiedPages.forEach((page) => pdfDoc.addPage(page));
    } else {
      // Normalize image with Sharp (auto-orient EXIF orientation, convert to standard PNG)
      const pngBuffer = await sharp(file.buffer)
        .rotate() // Automatically rotates based on EXIF camera orientation
        .png({ compressionLevel: 8 })
        .toBuffer();

      const embeddedImage = await pdfDoc.embedPng(pngBuffer);
      const { width, height } = embeddedImage;

      // Add page with matching image dimensions
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const primaryName = files[0].originalname.replace(/\.[^/.]+$/, '');

  return {
    pdfBuffer: Buffer.from(pdfBytes),
    filename: `${primaryName}.pdf`,
    pageCount: pdfDoc.getPageCount(),
  };
};

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateFile,
  normalizeToPdf,
};
