import Queue from 'bull';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');
const userQueue = new Queue('userQueue');

fileQueue.process(async (job, done) => {
  try {
    const { fileId, userId } = job.data;
    if (!fileId) throw new Error('Missing fileId');
    if (!userId) throw new Error('Missing userId');

    const requestedFile = await dbClient.files.findOne({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!requestedFile) throw new Error('File not found');

    const sizes = [500, 250, 100];
    const imgBuffer = fs.readFileSync(requestedFile.localPath);

    for (const size of sizes) {
      const thumbnail = await imageThumbnail(imgBuffer, { width: size });
      fs.writeFileSync(`${requestedFile.localPath}_${size}`, thumbnail);
    }

    done();
  } catch (error) {
    done(error);
  }
});

userQueue.process(async (job, done) => {
  try {
    const { userId } = job.data;
    if (!userId) throw new Error('Missing userId');

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) throw new Error('User not found');

    console.log(`Welcome ${user.email}!`);
    done();
  } catch (error) {
    done(error);
  }
});
