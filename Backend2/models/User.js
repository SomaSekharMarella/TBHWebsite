const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing the admin secret key

const userSchema = new mongoose.Schema({
    // The admin's unique secret key, hashed for security
    adminSecret: {
        type: String,
        required: true,
        unique: true,
    },
    // The email address associated with the admin, used for sending OTPs
    email: {
        type: String,
        required: true,
        unique: true, // Assuming only one admin email for this system
    },
    // Temporary OTP for authentication
    otp: {
        type: String,
    },
    // Expiration time for the OTP
    otpExpires: {
        type: Date,
    },
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// --- Mongoose Middleware (Pre-save hook) ---
// Hash the adminSecret before saving the user document
userSchema.pre('save', async function(next) {
    // Only hash if the adminSecret has been modified (or is new)
    if (!this.isModified('adminSecret')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10); // Generate a salt
        this.adminSecret = await bcrypt.hash(this.adminSecret, salt); // Hash the secret
        next(); // Proceed to save
    } catch (error) {
        next(error); // Pass any error to the next middleware
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;