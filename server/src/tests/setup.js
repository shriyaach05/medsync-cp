const mongoose = require('mongoose');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_at_least_32_characters_long';
  process.env.FILE_ENCRYPTION_KEY = '2c8585d39c9a99fc0666da3142bdeb203adaac03fc82c29718fc14e45079b7cf';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';

  // Use local test database
  const testUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/medsync_test';
  process.env.MONGODB_URI = testUri;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(testUri);

  // Initialize test GridFS bucket
  if (mongoose.connection && mongoose.connection.db) {
    new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'reports_files',
    });
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
