const Redis = require('ioredis');

// Create Redis client
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
});

// Handle Redis connection events
redisClient.on('connect', () => {
  console.log('🔌 Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redisClient.on('close', () => {
  console.log('🔒 Redis connection closed');
});

// Redis cluster configuration for production
const createRedisCluster = () => {
  return new Redis.Cluster([
    {
      host: process.env.REDIS_HOST1 || '127.0.0.1',
      port: process.env.REDIS_PORT1 || 6379,
    },
    {
      host: process.env.REDIS_HOST2 || '127.0.0.1',
      port: process.env.REDIS_PORT2 || 6380,
    },
  ], {
    scaleReads: 'slave',
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
    }
  });
};

module.exports = {
  redisClient,
  createRedisCluster
};