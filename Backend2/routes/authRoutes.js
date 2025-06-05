// Backend2/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import the User model
const bcrypt = require('bcryptjs'); // For comparing the admin secret
const jwt = require('jsonwebtoken'); // For generating JWT
const nodemailer = require('nodemailer'); // For sending emails
const crypto = require('crypto'); // For generating random OTPs

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' or configure for your email provider
    auth: {
        user: process.env.CLUB_EMAIL, // Your club email (sender)
        pass: process.env.CLUB_EMAIL_APP_PASSWORD, // Your generated App Password for Gmail
    },
});

// --- Utility Function to send OTP email ---
const sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.CLUB_EMAIL,
        to: email, // This email is the one passed into the function (should be CLUB_EMAIL)
        subject: 'Your Blockchain Club Admin Login OTP',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #0056b3;">Your One-Time Password (OTP)</h2>
                <p>Hello Admin,</p>
                <p>You have requested a One-Time Password (OTP) to log in to the Blockchain Club Admin Panel.</p>
                <p>Your OTP is: <strong><span style="font-size: 24px; color: #d9534f;">${otp}</span></strong></p>
                <p>This OTP is valid for <strong>10 minutes</strong>. Please do not share it with anyone.</p>
                <p>If you did not request this, please ignore this email.</p>
                <p>Thank you,</p>
                <p>The Blockchain Club Team</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

// Dummy store for OTPs (in a real app, use database like Redis or a proper DB field)
const otpStore = {}; // { email: { otp: '...', expires: Date } }

// @route   POST /api/auth/generate-otp
// @desc    Generate and send OTP for admin login, after verifying admin secret
// @access  Public
router.post('/generate-otp', async (req, res) => {
    const { email, adminSecret } = req.body; // Now expecting adminSecret

    // 1. Validate the incoming email against your configured admin email
    if (email !== process.env.CLUB_EMAIL) {
        return res.status(400).json({ message: 'Invalid admin email.' });
    }

    // 2. Verify the Admin Secret Key
    // IMPORTANT: For simplicity, we're comparing plain text.
    // In a production environment, you should hash ADMIN_SECRET in .env
    // and use bcrypt.compare(adminSecret, hashedSecret)
    if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ message: 'Invalid Admin Secret Key.' });
    }

    // If email and secret are correct, proceed to generate and send OTP
    const otp = crypto.randomBytes(3).toString('hex'); // 6-character hex OTP
    const expires = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes

    otpStore[email] = { otp, expires }; // Store the OTP in memory

    try {
        await sendOtpEmail(email, otp);
        res.json({ message: 'OTP sent to admin email.' });
    } catch (error) {
        console.error('Error sending OTP email:', error);
        res.status(500).json({ message: 'Failed to send OTP. Please check server logs.' });
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and return JWT for admin login
// @access  Public
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    // Validate the incoming email against your configured admin email
    if (email !== process.env.CLUB_EMAIL) {
       return res.status(400).json({ message: 'Invalid admin email.' });
    }

    const storedOtpData = otpStore[email];

    // Check if OTP exists, matches, and is not expired
    if (!storedOtpData || storedOtpData.otp !== otp || Date.now() > storedOtpData.expires) {
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // If OTP is valid, clear it from store to prevent reuse
    delete otpStore[email];

    try {
        // Find the admin user in your database
        let adminUser = await User.findOne({ email: email, role: 'admin' });

        if (!adminUser) {
            console.warn(`Admin user with email ${email} not found in DB. Using placeholder for JWT.`);
            adminUser = { _id: 'admin_id_placeholder_from_authroutes', role: 'admin' };
        }

        // Generate JWT payload with the 'user' object containing id and role
        const payload = {
            user: { // This 'user' object is what authMiddleware.js expects
                id: adminUser._id,
                role: adminUser.role
            }
        };

        // Sign the JWT
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }, // Token valid for 1 hour
            (err, token) => {
                if (err) throw err;
                res.json({ message: 'Logged in successfully!', token });
            }
        );
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// This route demonstrates how to use the authentication middleware.
// It will only be accessible after a successful verify-otp and with a valid JWT.
// @route   GET /api/auth/test-protected
// @desc    Test a protected route (requires JWT)
// @access  Private (Admin Only - via token verification)
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
router.get('/test-protected', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    res.json({ message: 'You have access to protected data!', user: req.user });
});

module.exports = router;