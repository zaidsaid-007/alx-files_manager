import Queue from 'bull';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import authUtils from '../utils/auth';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    try {
      const existingUser = await dbClient.users.findOne({ email });
      if (existingUser) return res.status(400).json({ error: 'Already exist' });

      const hashedPassword = sha1(password);
      const user = await dbClient.users.insertOne({ email, password: hashedPassword });

      const userQueue = new Queue('userQueue');
      userQueue.add({ userId: user.insertedId });

      return res.status(201).json({ id: user.insertedId, email });
    } catch (err) {
      return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    }
  }

  static async getMe(req, res) {
    try {
      const result = await authUtils.checkAuth(req);
      return res.status(result.status).json(result.payload);
    } catch (err) {
      return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    }
  }
}

export default UsersController;
