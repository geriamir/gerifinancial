const jwt = require('jsonwebtoken');
const config = require('../shared/config');

const createTestUser = async (User, userData = {}) => {
  try {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword',
      ...userData
    });
    
    // Save user and verify it was saved
    const savedUser = await user.save();
    if (!savedUser) {
      throw new Error('Failed to save user');
    }

    // Generate and verify token
    const token = jwt.sign(
      { userId: savedUser._id },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    // Verify token can be decoded
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded || decoded.userId !== savedUser._id.toString()) {
      throw new Error('Token verification failed');
    }

    return { user: savedUser, token };
  } catch (error) {
    console.error('Failed to create test user:', error);
    throw error;
  }
};

const clearDatabase = async (mongoose) => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
};

module.exports = {
  createTestUser,
  clearDatabase
};
