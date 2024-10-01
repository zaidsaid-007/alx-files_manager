import dbClient from './utils/db';

const waitConnection = () => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 10;
    const interval = 1000;

    const checkConnection = async () => {
      if (dbClient.isAlive()) {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('Failed to connect to the database'));
      } else {
        attempts += 1;
        setTimeout(checkConnection, interval);
      }
    };

    checkConnection();
  });
};

(async () => {
  try {
    console.log('Initial DB status:', dbClient.isAlive());
    await waitConnection();
    console.log('DB connected:', dbClient.isAlive());
    console.log('Number of users:', await dbClient.nbUsers());
    console.log('Number of files:', await dbClient.nbFiles());
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
