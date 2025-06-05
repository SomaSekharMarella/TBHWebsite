// Backend/models/TeamMember.js
const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    idNumber: {
        type: String,
        unique: true, // Assuming ID numbers should be unique
        sparse: true, // Allows null values if ID number is optional
        trim: true
    },
    photo: {
        type: {
            type: String, // 'upload', 'url', 'import'
            enum: ['upload', 'url', 'import'],
            default: 'url'
        },
        value: { // Path to uploaded file, URL, or identifier for imported
            type: String,
            default: 'https://via.placeholder.com/150' // Default placeholder image
        }
    },
    position: {
        type: String,
        required: true,
        trim: true
    },
    academicYear: {
        type: String, // e.g., 2024, 2025
        required: true,
        trim: true // Add trim for string types

    },
    displayOrder: { // Custom order for display on frontend
        type: Number,
        default: 99 // Default to a high number so lower numbers appear first
    },
    linkedinId: {
        type: String,
        trim: true
    },
    phoneNumber: {
        type: String,
        trim: true,
        match: [/^\+?[0-9]{10,15}$/, 'Please fill a valid phone number'] // Basic validation
    },
    isPhoneNumberPublic: {
        type: Boolean,
        default: false
    },
    telegramLink: {
        type: String,
        trim: true
    },
    isTelegramLinkPublic: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TeamMember', TeamMemberSchema);