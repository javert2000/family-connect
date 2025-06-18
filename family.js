const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
require('dotenv').config();

app.use(express.json());

mongoose.connect(process.env.MONGO_URI  || 'mongodb://127.0.0.1:27017/family-connect')
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Error connecting to MongoDB:', err));

app.get('/', (req, res) => {
  res.send('Family Connect API');
});

app.listen(port, () => console.log(`Server is running on port ${port}`));