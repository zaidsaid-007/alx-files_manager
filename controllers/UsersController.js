import Queue from 'bull';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import authUtils from '../utils/auth';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) return res.status(400).send({ error: 'Missing email' });
    if (!password) return res.status(400).send({ error: 'Missing password' });

    if (await dbClient.users.findOne({ email })) return res.status(400).send({ error: 'Already exist' });

    let user;
    try {
      user = await dbClient.users.insertOne({ email, password: sha1(password) });
    } catch (err) {
      return res.status(400).send({ error: `DB insert failed: ${err}` });
    }

    const userQueue = Queue('userQueue');
    userQueue.add({ userId: user.insertedId });

    return res.status(201).send({ id: user.insertedId, email });
  }

  static async getMe(req, res) {
    const result = await authUtils.checkAuth(req);
    return res.status(result.status).send(result.payload);
  }
}

module.exports = UsersController;
