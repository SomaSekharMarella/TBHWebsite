// Backend2/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1]; // Expecting "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ message: 'Token format invalid, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Ensure your JWT payload from authRoutes.js login/verify-otp has a 'user' object
        // e.g., jwt.sign({ user: { id: user._id, role: user.role } }, ...)
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('Token verification error:', err.message);
        return res.status(401).json({ message: 'Token is not valid or expired' });
    }
};

// Middleware to authorize user roles
const authorizeRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Access denied: No user or role information found in token.' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: `Access denied: Requires one of the following roles: ${roles.join(', ')}` });
        }
        next();
    };
};

// EXPORT BOTH FUNCTIONS AS PROPERTIES OF AN OBJECT
module.exports = { authenticateToken, authorizeRoles };