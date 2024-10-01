import redisClient from './utils/redis';

async function main() {
  console.log(redisClient.isAlive());

  const myKey = 'myKey';
  console.log(await redisClient.get(myKey));

  await redisClient.set(myKey, 12, 5);
  console.log(await redisClient.get(myKey));

  setTimeout(async () => {
    console.log(await redisClient.get(myKey));
  }, 1000 * 10);
}

main().catch(console.error);
