const { Sequelize } = require('sequelize');
require('dotenv').config();

const useSSL = process.env.DB_SSL === 'true';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,  // <-- use DB_PORT, not PORT
    dialect: 'postgres',
    logging: false,
    ...(useSSL && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    }),
  }
);

module.exports = sequelize;
