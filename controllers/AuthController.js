import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    // Reject if 'Authorization' header doesn't exist
    if (!req.headers.authorization) return res.status(401).send({ error: 'Unauthorized' });

    // Parse and decode header
    const authPayload = req.headers.authorization.split(' ')[1];
    const decodedAuthPayload = Buffer.from(authPayload, 'base64').toString('ascii');
    const [email, clearPwd] = decodedAuthPayload.split(':');

    // Reject if user doesn't exist or password doesn't match
    const user = await dbClient.users.findOne({ email });
    if (!user || sha1(clearPwd) !== user.password) return res.status(401).send({ error: 'Unauthorized' });

    // If user exists create token, cache auth and return token
    const authToken = uuidv4();
    const redisKey = `auth_${authToken}`;

    redisClient.set(redisKey, user._id.toString(), 86400);

    return res.status(200).send({ token: authToken });
  }

  static async getDisconnect(req, res) {
    if (!req.headers['x-token']) return res.status(401).send({ error: 'Unauthorized' });

    const redisKey = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(redisKey);

    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    await redisClient.del(redisKey);

    return res.status(204).end();
  }
}

module.exports = AuthController;
