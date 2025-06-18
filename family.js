const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
require('dotenv').config();

app.use(express.json());

mongoose.connect(process.env.MONGO_URI  || 'mongodb://localhost:27017/family-connect', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Error connecting to MongoDB:', err));

app.get('/', (req, res) => {
  res.send('Family Connect API');
});

app.listen(port, () => console.log(`Server is running on port ${port}`));