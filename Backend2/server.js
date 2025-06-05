// Backend2/server.js
require('dotenv').config(); // Load environment variables first

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Used for error handling specifically

// Import routes
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const teamRoutes = require('./routes/teamRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins during development
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Serve static files from the 'uploads' directory
// IMPORTANT: Create an 'uploads' folder in your backend root directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- MongoDB Connection ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Routes ---
// These lines mount your route handlers under specific base paths
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/team-members', teamRoutes);

// --- NEW TEST ROUTE (for debugging "API not found") ---
// This route should be directly accessible at http://localhost:5000/test
app.get('/test', (req, res) => {
    console.log('Test route /test was hit!'); // Log when this route is accessed
    res.status(200).json({ message: 'Test route is working!' });
});
// --- END NEW TEST ROUTE ---


// --- Error Handling Middleware ---
// Handle Multer errors specifically (should be placed before general error handler)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File size too large. Maximum 5MB allowed.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: 'Too many files uploaded or unexpected field name.' });
        }
        return res.status(400).json({ message: `Multer error: ${err.message}` });
    }
    // Pass other errors to the next error handler (or general 500 handler)
    next(err);
});

// General Error Handler (for any unhandled errors before 404)
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the full error stack for debugging
    res.status(500).json({ message: err.message || 'An unexpected server error occurred.' });
});

// 404 Not Found Middleware (Catch-all for undefined routes)
// This MUST be the LAST middleware/route in your server.js
app.use((req, res, next) => {
    res.status(404).json({ message: 'API Route not found' });
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});