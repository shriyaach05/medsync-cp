const mongoose = require('mongoose');

let gridFSBucket = null;

/**
 * Connect to MongoDB and initialize GridFS bucket for secure encrypted file storage.
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medsync';
    const conn = await mongoose.connect(mongoUri);

    console.log(`[Database] MongoDB Connected to ${conn.connection.name} on ${conn.connection.host}`);

    // Initialize GridFS bucket for confidential PDF storage
    gridFSBucket = new mongoose.mongo.GridFSBucket(conn.connection.db, {
      bucketName: 'reports_files',
    });

    return conn;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Get active GridFS bucket instance
 * @returns {mongoose.mongo.GridFSBucket}
 */
const getGridFSBucket = () => {
  if (!gridFSBucket) {
    if (mongoose.connection && mongoose.connection.db) {
      gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'reports_files',
      });
    } else {
      throw new Error('Database not connected. GridFS bucket is unavailable.');
    }
  }
  return gridFSBucket;
};

/**
 * Gracefully close database connection (used for tests and shutdown)
 */
const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    gridFSBucket = null;
  }
};

module.exports = {
  connectDB,
  getGridFSBucket,
  closeDB,
};
