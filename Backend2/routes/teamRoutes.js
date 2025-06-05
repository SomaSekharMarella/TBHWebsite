// Backend2/routes/teamRoutes.js
const express = require('express');
const router = express.Router();
const TeamMember = require('../models/TeamMember');

// Import authenticateToken and authorizeRoles using DESTRUCTURING
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Import the configured Multer instance
const upload = require('../config/multerConfig');

const path = require('path');
const fs = require('fs');

// --- Helper function to delete old photo file if it exists ---
const deleteOldPhoto = (photoPath) => {
    if (photoPath && photoPath.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', photoPath);
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting old photo file:', filePath, err);
            } else {
                console.log('Old photo file deleted:', filePath);
            }
        });
    }
};

// @route   GET /api/team-members
// @desc    Get all team members
// @access  Public
router.get('/', async (req, res) => {
    try {
        const teamMembers = await TeamMember.find().sort({ displayOrder: 1, academicYear: 1, name: 1 });
        res.json(teamMembers);
    } catch (err) {
        console.error('Error fetching team members:', err);
        res.status(500).json({ message: 'Server error fetching team members.' });
    }
});

// @route   GET /api/team-members/:id
// @desc    Get a single team member by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const teamMember = await TeamMember.findById(req.params.id);
        if (!teamMember) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        res.json(teamMember);
    } catch (err) {
        console.error('Error fetching team member:', err);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Team Member ID format.' });
        }
        res.status(500).json({ message: 'Server error fetching team member.' });
    }
});

// @route   POST /api/team-members
// @desc    Add a new team member
// @access  Private (Admin Only)
router.post(
    '/',
    authenticateToken,
    authorizeRoles(['admin']),
    upload.single('photo'),
    async (req, res) => {
        try {
            const {
                name,
                idNumber,
                position,
                academicYear,
                displayOrder,
                linkedinId,
                phoneNumber,
                isPhoneNumberPublic,
                telegramLink,
                isTelegramLinkPublic,
                photoType
            } = req.body;

            let photoValue;
            let actualPhotoType = photoType;

            if (req.file) {
                photoValue = `/uploads/${req.file.filename}`;
                actualPhotoType = 'upload';
            } else if (photoType === 'url' && req.body.photoValue) {
                photoValue = req.body.photoValue;
            } else if (photoType === 'import' && req.body.photoValue) {
                photoValue = req.body.photoValue;
            } else {
                photoValue = 'https://via.placeholder.com/150';
                actualPhotoType = 'url';
            }

            if (!name || !position || !academicYear) {
                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error('Error deleting orphaned uploaded file:', err);
                    });
                }
                return res.status(400).json({ message: 'Name, position, and academic year are required.' });
            }

            const newTeamMember = new TeamMember({
                name,
                idNumber,
                photo: {
                    type: actualPhotoType,
                    value: photoValue
                },
                position,
                academicYear,
                displayOrder: typeof displayOrder === 'number' ? displayOrder : (parseInt(displayOrder) || 99),
                linkedinId,
                phoneNumber,
                isPhoneNumberPublic: isPhoneNumberPublic === 'true' || isPhoneNumberPublic === true,
                telegramLink,
                isTelegramLinkPublic: isTelegramLinkPublic === 'true' || isTelegramLinkPublic === true
            });

            const savedTeamMember = await newTeamMember.save();
            res.status(201).json({ message: 'Team member saved successfully!', teamMember: savedTeamMember });

        } catch (err) {
            console.error('Error saving team member:', err);
            if (err.name === 'ValidationError') {
                const messages = Object.values(err.errors).map(val => val.message);
                return res.status(400).json({ message: messages.join(', ') });
            }
            res.status(500).json({ message: 'Server error saving team member.' });
        }
    }
);

// @route   PUT /api/team-members/:id
// @desc    Update an existing team member
// @access  Private (Admin Only)
router.put(
    '/:id',
    authenticateToken,
    authorizeRoles(['admin']),
    upload.single('photo'),
    async (req, res) => {
        try {
            const {
                name,
                idNumber,
                position,
                academicYear,
                displayOrder,
                linkedinId,
                phoneNumber,
                isPhoneNumberPublic,
                telegramLink,
                isTelegramLinkPublic,
                photoType
            } = req.body;

            const existingTeamMember = await TeamMember.findById(req.params.id);
            if (!existingTeamMember) {
                if (req.file) {
                    fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting newly uploaded file:', err); });
                }
                return res.status(404).json({ message: 'Team member not found.' });
            }

            let updateFields = {
                name,
                idNumber,
                position,
                academicYear,
                displayOrder: typeof displayOrder === 'number' ? displayOrder : (parseInt(displayOrder) || 99),
                linkedinId,
                phoneNumber,
                isPhoneNumberPublic: isPhoneNumberPublic === 'true' || isPhoneNumberPublic === true,
                telegramLink,
                isTelegramLinkPublic: isTelegramLinkPublic === 'true' || isTelegramLinkPublic === true
            };

            if (req.file) {
                deleteOldPhoto(existingTeamMember.photo.value);
                updateFields.photo = { type: 'upload', value: `/uploads/${req.file.filename}` };
            } else if (photoType) {
                if (photoType === 'url') {
                    if (existingTeamMember.photo.type === 'upload') {
                        deleteOldPhoto(existingTeamMember.photo.value);
                    }
                    updateFields.photo = { type: 'url', value: req.body.photoValue };
                } else if (photoType === 'import') {
                    if (existingTeamMember.photo.type === 'upload') {
                        deleteOldPhoto(existingTeamMember.photo.value);
                    }
                    updateFields.photo = { type: 'import', value: req.body.photoValue };
                } else {
                    return res.status(400).json({ message: 'Invalid photo type specified for update.' });
                }
            }

            const updatedTeamMember = await TeamMember.findByIdAndUpdate(
                req.params.id,
                { $set: updateFields },
                { new: true, runValidators: true }
            );

            res.json({ message: 'Team member updated successfully!', teamMember: updatedTeamMember });

        } catch (err) {
            console.error('Error updating team member:', err);
            if (err.kind === 'ObjectId') {
                return res.status(400).json({ message: 'Invalid Team Member ID format.' });
            }
            if (err.name === 'ValidationError') {
                const messages = Object.values(err.errors).map(val => val.message);
                return res.status(400).json({ message: messages.join(', ') });
            }
            res.status(500).json({ message: 'Server error updating team member.' });
        }
    }
);

// @route   DELETE /api/team-members/:id
// @desc    Delete a team member
// @access  Private (Admin Only)
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles(['admin']),
    async (req, res) => {
        try {
            const teamMember = await TeamMember.findById(req.params.id);

            if (!teamMember) {
                return res.status(404).json({ message: 'Team member not found' });
            }

            if (teamMember.photo && teamMember.photo.type === 'upload' && teamMember.photo.value) {
                deleteOldPhoto(teamMember.photo.value);
            }

            await TeamMember.findByIdAndDelete(req.params.id);

            res.json({ message: 'Team member deleted successfully!' });

        } catch (err) {
            console.error('Error deleting team member:', err);
            if (err.kind === 'ObjectId') {
                return res.status(400).json({ message: 'Invalid Team Member ID format.' });
            }
            res.status(500).json({ message: 'Server error deleting team member.' });
        }
    }
);

module.exports = router;