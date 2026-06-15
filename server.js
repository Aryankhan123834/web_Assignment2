require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const bookRoutes = require('./routes/books');

const app = express();

// Middleware
app.use(express.json());
app.use(logger);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch((err) => {
    console.error('Database connection error:', err.message);
  });

// Routes
app.use('/api/books', bookRoutes);

// Home Route (important for Vercel)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Online Bookstore API is running'
  });
});

// Invalid Routes
app.use((req, res, next) => {
  const error = new Error(`Route Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// Error Handler
app.use(errorHandler);

// Start server locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;