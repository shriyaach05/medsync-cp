require('dotenv').config();
const app = require('./app');
const { connectDB, closeDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB & initialize GridFS bucket
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log('==================================================');
      console.log(` MedSync API Server successfully started on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Health Endpoint: http://localhost:${PORT}/api/health`);
      console.log('==================================================');
    });

    // Graceful Shutdown Handlers
    const handleShutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Closing HTTP server and database connection...`);
      server.close(async () => {
        try {
          await closeDB();
          console.log('[Server] Database closed. Server shutdown complete.');
          process.exit(0);
        } catch (err) {
          console.error('[Server Error] Error during shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    console.error('[Server Error] Failed to start application:', error.message);
    process.exit(1);
  }
};

startServer();
