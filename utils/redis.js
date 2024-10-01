import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => console.error('Redis Client Error:', err));

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.setex).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  /**
   * Check if the Redis client is connected
   * @returns {boolean} - True if connected, otherwise false
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Get the value of a key from Redis
   * @param {string} key - The key to retrieve
   * @returns {Promise<string>} - The value of the key
   */
  async get(key) {
    try {
      return await this.getAsync(key);
    } catch (err) {
      console.error('Redis GET Error:', err);
      throw err;
    }
  }

  /**
   * Set a key-value pair in Redis with an expiration time
   * @param {string} key - The key to set
   * @param {string} value - The value to set
   * @param {number} duration - The expiration time in seconds
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    try {
      await this.setAsync(key, duration, value);
    } catch (err) {
      console.error('Redis SET Error:', err);
      throw err;
    }
  }

  /**
   * Delete a key from Redis
   * @param {string} key - The key to delete
   * @returns {Promise<void>}
   */
  async del(key) {
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error('Redis DEL Error:', err);
      throw err;
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
