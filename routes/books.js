const express = require('express');
const router = express.Router();
const Book = require('../models/Book');

// @desc    Get all books (with search & pagination)
// @route   GET /api/books
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const { author, genre, page = 1, limit = 10 } = req.query;

    // Build the query object for search
    const query = {};
    if (author) {
      query.author = { $regex: author, $options: 'i' }; // Case-insensitive partial match
    }
    if (genre) {
      query.genre = { $regex: genre, $options: 'i' }; // Case-insensitive partial match
    }

    // Parse and validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "page" must be a positive integer'
      });
    }
    if (isNaN(limitNum) || limitNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "limit" must be a positive integer'
      });
    }

    const skip = (pageNum - 1) * limitNum;

    // Fetch data and count in parallel
    const [books, totalBooks] = await Promise.all([
      Book.find(query).skip(skip).limit(limitNum).sort({ createdAt: -1 }).exec(),
      Book.countDocuments(query).exec()
    ]);

    const totalPages = Math.ceil(totalBooks / limitNum);

    res.status(200).json({
      success: true,
      count: books.length,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages === 0 ? 1 : totalPages,
        totalBooks,
        limit: limitNum
      },
      data: books
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get a single book by ID
// @route   GET /api/books/:id
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book not found with id of ${req.params.id}`
      });
    }
    res.status(200).json({
      success: true,
      data: book
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Add a new book
// @route   POST /api/books
// @access  Public
router.post('/', async (req, res, next) => {
  try {
    const { title, author, genre, price, publishedDate, inStock } = req.body;

    // Manual validation for required fields
    const missingFields = [];
    if (!title) missingFields.push('title');
    if (!author) missingFields.push('author');
    if (price === undefined) missingFields.push('price');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Validation Error: Missing required field(s): ${missingFields.join(', ')}`
      });
    }

    const book = await Book.create({
      title,
      author,
      genre,
      price,
      publishedDate,
      inStock
    });

    res.status(201).json({
      success: true,
      data: book
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Update an existing book by ID
// @route   PUT /api/books/:id
// @access  Public
router.put('/:id', async (req, res, next) => {
  try {
    const { title, author, genre, price, publishedDate, inStock } = req.body;

    // Validate price if it is updated
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Price must be a non-negative number'
      });
    }

    // Find and update with validation checks
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      { title, author, genre, price, publishedDate, inStock },
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: book
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Delete a book by ID
// @route   DELETE /api/books/:id
// @access  Public
router.delete('/:id', async (req, res, next) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book not found with id of ${req.params.id}`
      });
    }
    res.status(200).json({
      success: true,
      message: 'Book successfully deleted',
      data: book
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
