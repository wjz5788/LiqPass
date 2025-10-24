// Setup file for backend tests
import db from '../src/db.js';

// Clear database before each test
beforeEach(() => {
  // Add any necessary setup code here
});

// Close database connections after all tests
afterAll(() => {
  db.close();
});