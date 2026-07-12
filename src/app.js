const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRouter     = require('./routes/auth');
const usersRouter    = require('./routes/users');
const productsRouter = require('./routes/products');
const ordersRouter   = require('./routes/orders');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
);

app.use('/api/auth',     authRouter);
app.use('/api/users',    usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders',   ordersRouter);

app.use(errorHandler);

module.exports = app;
