// src/app.js
const express = require('express');
const dotenv = require('dotenv');
const sequelize = require('./config/database')

//Routes
const authRoutes = require('./routes/authRoutes');


dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Test DB connection + sync models
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Make sure models are loaded before sync
    require('./models/Owner');
   

    await sequelize.sync(); // or { alter: true } during development
    console.log('Database synced.');
  } catch (err) {
    console.error('Unable to connect to the database:', err);
  }
})();

// Routes
app.use('/api/auth', authRoutes);


// Test route
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
