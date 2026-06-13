// authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please include Authorization header with Bearer token.'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set!');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      // Helpful debug logging in dev to understand why verification failed
      try {
        const masked = token ? `${token.substring(0,8)}...${token.substring(token.length-8)}` : 'no-token';
        console.warn('[authmiddleware] jwt verification failed:', jwtError && jwtError.message, 'maskedToken:', masked);
        const decoded = jwt.decode(token, { complete: true });
        console.warn('[authmiddleware] decoded token (not verified):', decoded ? { header: decoded.header, payload: decoded.payload } : null);
      } catch (e) {
        // ignore logging errors
      }

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired', expired: true });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // No DB lookup — all needed fields are embedded in the JWT payload.
    // generateToken() puts userId, email, name, isVerified in the token.
    req.user = {
      userId:     decoded.userId,
      id:         decoded.userId,
      _id:        decoded.userId,
      email:      decoded.email,
      name:       decoded.name,
      isVerified: decoded.isVerified,
      ...decoded,
    };

    next();
  } catch (error) {
    console.error('Auth middleware unexpected error:', error);
    res.status(500).json({ success: false, message: 'Authentication service temporarily unavailable' });
  }
}; 

module.exports = authMiddleware;