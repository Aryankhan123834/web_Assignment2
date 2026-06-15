const mongoose = require('mongoose');
const http = require('http');
const { app, server } = require('./server');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Helper to make HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Main verification flow
async function runTests() {
  console.log('=== STARTING BOOKSTORE API VERIFICATION ===\n');

  // Wait for mongoose to connect
  if (mongoose.connection.readyState !== 1) {
    console.log('Waiting for MongoDB connection...');
    await new Promise((resolve) => {
      mongoose.connection.once('open', resolve);
    });
  }
  console.log('MongoDB connected successfully.\n');

  // Clear existing books for a clean test run
  console.log('Clearing database for test...');
  await mongoose.connection.db.collection('books').deleteMany({});
  console.log('Database cleared.\n');

  let testBooks = [
    { title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'Fantasy', price: 10.99, publishedDate: new Date('1937-09-21'), inStock: true },
    { title: 'The Fellowship of the Ring', author: 'J.R.R. Tolkien', genre: 'Fantasy', price: 12.99, publishedDate: new Date('1954-07-29'), inStock: true },
    { title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', price: 9.99, publishedDate: new Date('1965-08-01'), inStock: true },
    { title: 'Foundation', author: 'Isaac Asimov', genre: 'Sci-Fi', price: 8.99, publishedDate: new Date('1951-06-01'), inStock: false },
    { title: 'Neuromancer', author: 'William Gibson', genre: 'Cyberpunk', price: 7.99, publishedDate: new Date('1984-07-01'), inStock: true }
  ];

  let createdBooks = [];

  // 1. Test POST /api/books (Add Books)
  console.log('--- Test 1: Add New Books ---');
  for (let bookData of testBooks) {
    const res = await request('POST', '/api/books', bookData);
    if (res.status === 201 && res.data.success) {
      console.log(`+ Created book: "${res.data.data.title}" by ${res.data.data.author}`);
      createdBooks.push(res.data.data);
    } else {
      console.error(`- Failed to create book: ${JSON.stringify(res.data)}`);
    }
  }
  console.log();

  // 2. Test POST Validation Error (Missing fields)
  console.log('--- Test 2: Add Book Validation Error ---');
  const badBook = { title: 'Missing Author & Price' };
  const resBadPost = await request('POST', '/api/books', badBook);
  if (resBadPost.status === 400 && !resBadPost.data.success) {
    console.log(`+ Correctly blocked invalid POST request with status 400. Message: "${resBadPost.data.message}"`);
  } else {
    console.error(`- Expected 400 bad request, got: ${resBadPost.status} ${JSON.stringify(resBadPost.data)}`);
  }
  console.log();

  // 3. Test GET /api/books (Retrieve all books)
  console.log('--- Test 3: Get All Books (Default pagination) ---');
  const resGetAll = await request('GET', '/api/books');
  if (resGetAll.status === 200 && resGetAll.data.success) {
    console.log(`+ Success! Found ${resGetAll.data.count} books (Total: ${resGetAll.data.pagination.totalBooks}).`);
  } else {
    console.error(`- Failed to get all books: ${JSON.stringify(resGetAll.data)}`);
  }
  console.log();

  // 4. Test GET /api/books (Pagination check)
  console.log('--- Test 4: Pagination (page=2, limit=2) ---');
  const resPage = await request('GET', '/api/books?page=2&limit=2');
  if (resPage.status === 200 && resPage.data.success) {
    console.log(`+ Current Page: ${resPage.data.pagination.currentPage}`);
    console.log(`+ Total Pages: ${resPage.data.pagination.totalPages}`);
    console.log(`+ Returned ${resPage.data.count} books for limit 2 (Expected: 2)`);
  } else {
    console.error(`- Pagination failed: ${JSON.stringify(resPage.data)}`);
  }
  console.log();

  // 5. Test GET /api/books (Search by Author)
  console.log('--- Test 5: Search by Author (Tolkien) ---');
  const resSearchAuthor = await request('GET', '/api/books?author=Tolkien');
  if (resSearchAuthor.status === 200 && resSearchAuthor.data.success) {
    console.log(`+ Found ${resSearchAuthor.data.count} books matching "Tolkien".`);
    resSearchAuthor.data.data.forEach(b => console.log(`  - "${b.title}" by ${b.author}`));
  } else {
    console.error(`- Search by author failed: ${JSON.stringify(resSearchAuthor.data)}`);
  }
  console.log();

  // 6. Test GET /api/books (Search by Genre)
  console.log('--- Test 6: Search by Genre (Sci-Fi) ---');
  const resSearchGenre = await request('GET', '/api/books?genre=Sci-Fi');
  if (resSearchGenre.status === 200 && resSearchGenre.data.success) {
    console.log(`+ Found ${resSearchGenre.data.count} books matching "Sci-Fi".`);
    resSearchGenre.data.data.forEach(b => console.log(`  - "${b.title}" (${b.genre})`));
  } else {
    console.error(`- Search by genre failed: ${JSON.stringify(resSearchGenre.data)}`);
  }
  console.log();

  // 7. Test GET /api/books/:id (Get Single Book)
  console.log('--- Test 7: Get Book By ID ---');
  const bookToGet = createdBooks[0];
  const resGetOne = await request('GET', `/api/books/${bookToGet._id}`);
  if (resGetOne.status === 200 && resGetOne.data.data.title === bookToGet.title) {
    console.log(`+ Retrieved book correctly: "${resGetOne.data.data.title}"`);
  } else {
    console.error(`- Failed to retrieve book by ID: ${JSON.stringify(resGetOne.data)}`);
  }
  console.log();

  // 8. Test PUT /api/books/:id (Update Book)
  console.log('--- Test 8: Update Book By ID ---');
  const bookToUpdate = createdBooks[2]; // Dune
  const updateData = { price: 14.99, inStock: false };
  const resPut = await request('PUT', `/api/books/${bookToUpdate._id}`, updateData);
  if (resPut.status === 200 && resPut.data.data.price === 14.99 && resPut.data.data.inStock === false) {
    console.log(`+ Successfully updated "${resPut.data.data.title}" Price: ${resPut.data.data.price}, inStock: ${resPut.data.data.inStock}`);
  } else {
    console.error(`- Failed to update book: ${JSON.stringify(resPut.data)}`);
  }
  console.log();

  // 9. Test PUT Validation Error
  console.log('--- Test 9: Update Validation Error (negative price) ---');
  const resPutBad = await request('PUT', `/api/books/${bookToUpdate._id}`, { price: -5 });
  if (resPutBad.status === 400 && !resPutBad.data.success) {
    console.log(`+ Correctly rejected negative price update. Message: "${resPutBad.data.message}"`);
  } else {
    console.error(`- Expected 400 status, got ${resPutBad.status}: ${JSON.stringify(resPutBad.data)}`);
  }
  console.log();

  // 10. Test DELETE /api/books/:id
  console.log('--- Test 10: Delete Book By ID ---');
  const bookToDelete = createdBooks[4]; // Neuromancer
  const resDelete = await request('DELETE', `/api/books/${bookToDelete._id}`);
  if (resDelete.status === 200 && resDelete.data.success) {
    console.log(`+ Successfully deleted: "${resDelete.data.data.title}"`);
    // Verify it is gone
    const resGetDeleted = await request('GET', `/api/books/${bookToDelete._id}`);
    if (resGetDeleted.status === 404) {
      console.log(`+ Verified: GET by ID returned 404 not found.`);
    } else {
      console.error(`- Expected 404, got ${resGetDeleted.status}`);
    }
  } else {
    console.error(`- Failed to delete book: ${JSON.stringify(resDelete.data)}`);
  }
  console.log();

  // 11. Test Error Handling: Invalid route
  console.log('--- Test 11: Invalid Route Handler ---');
  const resInvalidRoute = await request('GET', '/api/invalid-endpoint-path');
  if (resInvalidRoute.status === 404 && !resInvalidRoute.data.success) {
    console.log(`+ Caught invalid route correctly. Message: "${resInvalidRoute.data.message}"`);
  } else {
    console.error(`- Expected 404 invalid route, got ${resInvalidRoute.status}: ${JSON.stringify(resInvalidRoute.data)}`);
  }
  console.log();

  // 12. Test Error Handling: Invalid ObjectId format
  console.log('--- Test 12: Invalid ObjectId Format ---');
  const resInvalidId = await request('GET', '/api/books/invalid-id-format-123');
  if (resInvalidId.status === 400 && !resInvalidId.data.success) {
    console.log(`+ Correctly caught Mongoose CastError. Message: "${resInvalidId.data.message}"`);
  } else {
    console.error(`- Expected 400 invalid ObjectId, got ${resInvalidId.status}: ${JSON.stringify(resInvalidId.data)}`);
  }
  console.log();

  console.log('=== VERIFICATION COMPLETED ===');
  cleanup();
}

function cleanup() {
  server.close(() => {
    console.log('Express server shut down.');
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed. Exiting test.');
      process.exit(0);
    });
  });
}

runTests().catch(err => {
  console.error('An error occurred during verification:', err);
  cleanup();
});
