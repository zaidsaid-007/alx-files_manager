import express from 'express';

const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// adding this to decode json post bodies
app.use(express.json());

app.use('/', routes);

export default app;
