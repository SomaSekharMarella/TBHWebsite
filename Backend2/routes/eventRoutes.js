// Backend2/routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const Event = require('../models/Event'); // Assuming your model is in models/Event.js

// Import authenticateToken and authorizeRoles using DESTRUCTURING
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Import the configured Multer instance
const upload = require('../config/multerConfig');

const path = require('path');
const fs = require('fs');

// --- Helper function to delete old poster file if it exists ---
const deleteOldPoster = (posterPath) => {
    if (posterPath && posterPath.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', posterPath);
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting old poster file:', filePath, err);
            } else {
                console.log('Old poster file deleted:', filePath);
            }
        });
    }
};

// @route   GET /api/events
// @desc    Get all events
// @access  Public
router.get('/', async (req, res) => {
    try {
        // Sort by date, most recent first
        const events = await Event.find().sort({ eventDate: -1 });
        res.json(events);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ message: 'Server error fetching events.' });
    }
});

// @route   GET /api/events/:id
// @desc    Get a single event by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(event);
    } catch (err) {
        console.error('Error fetching event:', err);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Event ID format.' });
        }
        res.status(500).json({ message: 'Server error fetching event.' });
    }
});

// @route   POST /api/events
// @desc    Add a new event
// @access  Private (Admin Only)
router.post(
    '/',
    authenticateToken,
    authorizeRoles(['admin']),
    upload.single('posterFile'), // 'posterFile' is the field name for the uploaded file
    async (req, res) => {
        try {
            const {
                eventName,
                eventDate,
                eventTime,
                eventLocation,
                eventLink,
                academicYear,
                description,
                speakers, // This should be a JSON string if sent via form-data
                posterType // 'upload', 'url'
            } = req.body;

            let posterValue;
            let actualPosterType = posterType;

            // Determine the poster source
            if (req.file) { // If a file was uploaded via Multer
                posterValue = `/uploads/${req.file.filename}`;
                actualPosterType = 'upload';
            } else if (posterType === 'url' && req.body.posterValue) {
                posterValue = req.body.posterValue;
            } else {
                posterValue = 'https://via.placeholder.com/300x200?text=No+Poster'; // Default placeholder
                actualPosterType = 'url';
            }

            // Basic validation
            if (!eventName || !eventDate || !academicYear || !eventLocation) {
                // If file was uploaded but validation fails, delete the file to prevent orphans
                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error('Error deleting orphaned uploaded file:', err);
                    });
                }
                return res.status(400).json({ message: 'Event name, date, academic year, and location are required.' });
            }

            // Parse speakers if it's a JSON string
            let parsedSpeakers = [];
            if (speakers) {
                try {
                    parsedSpeakers = JSON.parse(speakers);
                    // Basic validation for parsedSpeakers to ensure it's an array of objects
                    if (!Array.isArray(parsedSpeakers) || !parsedSpeakers.every(s => typeof s === 'object' && s !== null)) {
                        throw new Error('Speakers must be a valid JSON array of objects.');
                    }
                } catch (e) {
                    console.error('Error parsing speakers JSON:', e);
                    return res.status(400).json({ message: 'Invalid speakers format. Must be a valid JSON array.' });
                }
            }

            const newEvent = new Event({
                eventName,
                eventDate: new Date(eventDate), // Ensure date is parsed
                eventTime,
                eventLocation,
                eventLink,
                academicYear,
                description,
                speakers: parsedSpeakers,
                poster: {
                    type: actualPosterType,
                    value: posterValue
                }
            });

            const savedEvent = await newEvent.save();
            res.status(201).json({ message: 'Event saved successfully!', event: savedEvent });

        } catch (err) {
            console.error('Error saving event:', err);
            if (err.name === 'ValidationError') {
                const messages = Object.values(err.errors).map(val => val.message);
                return res.status(400).json({ message: messages.join(', ') });
            }
            res.status(500).json({ message: 'Server error saving event.' });
        }
    }
);

// @route   PUT /api/events/:id
// @desc    Update an existing event
// @access  Private (Admin Only)
router.put(
    '/:id',
    authenticateToken,
    authorizeRoles(['admin']),
    upload.single('posterFile'),
    async (req, res) => {
        try {
            const {
                eventName,
                eventDate,
                eventTime,
                eventLocation,
                eventLink,
                academicYear,
                description,
                speakers,
                posterType // 'upload', 'url'
            } = req.body;

            const existingEvent = await Event.findById(req.params.id);
            if (!existingEvent) {
                if (req.file) { // If new file uploaded but event not found, delete it
                    fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting new file:', err); });
                }
                return res.status(404).json({ message: 'Event not found.' });
            }

            let updateFields = {
                eventName,
                eventDate: new Date(eventDate),
                eventTime,
                eventLocation,
                eventLink,
                academicYear,
                description,
            };

            // Parse speakers if provided
            if (speakers !== undefined) {
                try {
                    updateFields.speakers = JSON.parse(speakers);
                    if (!Array.isArray(updateFields.speakers) || !updateFields.speakers.every(s => typeof s === 'object' && s !== null)) {
                        throw new Error('Speakers must be a valid JSON array of objects.');
                    }
                } catch (e) {
                    console.error('Error parsing speakers JSON during update:', e);
                    return res.status(400).json({ message: 'Invalid speakers format for update.' });
                }
            }

            // Handle poster updates
            if (req.file) { // New file uploaded
                deleteOldPoster(existingEvent.poster.value);
                updateFields.poster = { type: 'upload', value: `/uploads/${req.file.filename}` };
            } else if (posterType) { // Frontend specified type (URL), but no file uploaded
                if (posterType === 'url') {
                    if (existingEvent.poster.type === 'upload') { // If old was upload, delete it
                        deleteOldPoster(existingEvent.poster.value);
                    }
                    updateFields.poster = { type: 'url', value: req.body.posterValue };
                } else {
                    return res.status(400).json({ message: 'Invalid poster type specified for update.' });
                }
            }
            // If no req.file and no posterType, poster remains unchanged.


            const updatedEvent = await Event.findByIdAndUpdate(
                req.params.id,
                { $set: updateFields },
                { new: true, runValidators: true }
            );

            res.json({ message: 'Event updated successfully!', event: updatedEvent });

        } catch (err) {
            console.error('Error updating event:', err);
            if (err.kind === 'ObjectId') {
                return res.status(400).json({ message: 'Invalid Event ID format.' });
            }
            if (err.name === 'ValidationError') {
                const messages = Object.values(err.errors).map(val => val.message);
                return res.status(400).json({ message: messages.join(', ') });
            }
            res.status(500).json({ message: 'Server error updating event.' });
        }
    }
);

// @route   DELETE /api/events/:id
// @desc    Delete an event
// @access  Private (Admin Only)
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles(['admin']),
    async (req, res) => {
        try {
            const event = await Event.findById(req.params.id);

            if (!event) {
                return res.status(404).json({ message: 'Event not found' });
            }

            // Optional: If event poster is stored locally, delete the old file from the server
            if (event.poster && event.poster.type === 'upload' && event.poster.value) {
                deleteOldPoster(event.poster.value);
            }

            await Event.findByIdAndDelete(req.params.id);

            res.json({ message: 'Event deleted successfully!' });

        } catch (err) {
            console.error('Error deleting event:', err);
            if (err.kind === 'ObjectId') {
                return res.status(400).json({ message: 'Invalid Event ID format.' });
            }
            res.status(500).json({ message: 'Server error deleting event.' });
        }
    }
);

module.exports = router;