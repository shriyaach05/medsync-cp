const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * Health check endpoint for monitoring system, database, and deployment status.
 * GET /api/health
 */
router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'MedSync API',
    database: dbStatusMap[dbState] || 'unknown',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
