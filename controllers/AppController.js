import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static async getStatus(request, response) {
    try {
      const redisStatus = await redisClient.isAlive();
      const dbStatus = await dbClient.isAlive();
      response.status(200).send({ redis: redisStatus, db: dbStatus });
    } catch (error) {
      response.status(500).send({ error: 'Unable to retrieve status' });
    }
  }

  static async getStats(request, response) {
    try {
      const usersCount = await dbClient.nbUsers();
      const filesCount = await dbClient.nbFiles();
      response.status(200).send({ users: usersCount, files: filesCount });
    } catch (error) {
      response.status(500).send({ error: 'Unable to retrieve stats' });
    }
  }
}

export default AppController;
