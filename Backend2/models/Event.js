const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    eventName: {
        type: String,
        required: [true, 'Event name is required'],
        trim: true, // Remove whitespace from both ends of a string
        minlength: [3, 'Event name must be at least 3 characters long']
    },
    eventDate: {
        type: Date,
        required: [true, 'Event date is required'],
    },
    eventDescription: {
        type: String,
        default: '', // Optional, but provides a default empty string
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    // Speakers will now be an array of objects
    speakers: [{
        name: {
            type: String,
            required: [true, 'Speaker name is required'],
            trim: true
        },
        id: {
            type: Number, // Storing ID Number as a Number
            required: [true, 'Speaker ID is required'],
            min: [1, 'Speaker ID must be a positive number'] // Assuming IDs are positive
        }
    }],
    // Poster field to handle both uploaded files and external URLs
    poster: {
        type: {
            type: String,
            required: [true, 'Poster type is required'],
            enum: ['upload', 'url'], // Must be either 'upload' or 'url'
        },
        value: {
            type: String,
            required: [true, 'Poster value (filepath or URL) is required'],
            trim: true,
            // Add basic URL validation if type is 'url'
            validate: {
                validator: function(v) {
                    if (this.type === 'url') {
                        // Simple URL regex validation (can be more robust if needed)
                        return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v);
                    }
                    return true; // No validation needed if type is 'upload'
                },
                message: props => `${props.value} is not a valid URL for poster type 'url'!`
            }
        }
    },
    reportLink: {
        type: String,
        default: null, // Default to null if no report link is provided
        // Basic URL validation
        validate: {
            validator: function(v) {
                if (v === null || v === '') return true; // Allow null or empty string
                return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v);
            },
            message: props => `${props.value} is not a valid URL for report link!`
        }
    },
    academicYear: {
        type: String,
        required: [true, 'Academic year is required'],
        enum: {
            values: ['2024-25', '2025-26'],
            message: 'Academic year must be 2024-25 or 2025-26'
        }
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// Custom validation for speakers array: must not be empty and all elements must be valid
eventSchema.path('speakers').validate(function(value) {
    if (!value || value.length === 0) {
        return false; // Speakers array must not be empty
    }
    // Ensure every speaker object has a name and a valid ID
    return value.every(speaker => speaker && speaker.name && typeof speaker.id === 'number' && speaker.id >= 1);
}, 'At least one speaker with a valid name and ID is required.');


const Event = mongoose.model('Event', eventSchema);

module.exports = Event;