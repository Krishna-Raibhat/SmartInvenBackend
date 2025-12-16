// src/app.js
const express = require('express');
const dotenv = require('dotenv');
const sequelize = require('./config/database')

//Routes
const authRoutes = require('./routes/authRoutes');
const hardProdRoutes=require('./routes/hardProdRoute');
const hardSupplierRoutes= require('./routes/hardwareSupplierRoutes');


dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.use('/api/hardwareProducts', hardProdRoutes);
app.use('/api/hardwareSupplier', hardSupplierRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Test DB connection + sync models
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Make sure models are loaded before sync
    require('./models/Package');
    require('./models/Owner');
    require('./models/HardwareSupplier');
    require('./models/HardwareProduct');
    
    await sequelize.sync(); // or { alter: true } during development
    console.log('Database synced.');
  } catch (err) {
    console.error('Unable to connect to the database:', err);
  }
})();



module.exports = app;
