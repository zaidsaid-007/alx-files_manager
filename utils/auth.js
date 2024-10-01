import { ObjectId } from 'mongodb';
import dbClient from './db';
import redisClient from './redis';

class AuthUtils {
  /**
   * Checks the authentication of a request.
   * @param {Object} req - The request object.
   * @returns {Promise<Object>} The status and payload of the authentication check.
   */
  checkAuth = async (req) => {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return { status: 401, payload: { error: 'Unauthorized' } };
      }

      const redisKey = `auth_${token}`;
      const userId = await redisClient.get(redisKey);
      if (!userId) {
        return { status: 401, payload: { error: 'Unauthorized' } };
      }

      const user = await dbClient.users.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return { status: 401, payload: { error: 'Unauthorized' } };
      }

      return { status: 200, payload: { id: user._id, email: user.email } };
    } catch (error) {
      console.error('Error checking authentication:', error);
      return { status: 500, payload: { error: 'Internal Server Error' } };
    }
  }
}

export default new AuthUtils();
