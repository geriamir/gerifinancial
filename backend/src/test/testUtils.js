const jwt = require('jsonwebtoken');
const config = require('../shared/config');

// GitHub ids are unique per account, so tests that create several users need a
// distinct one each time rather than a shared literal.
let githubIdSequence = 1000;

/**
 * Builds the external-identity fields every user now requires. Exported so
 * suites constructing a User directly stay consistent with createTestUser.
 */
const githubIdentity = (overrides = {}) => {
  githubIdSequence += 1;
  return {
    githubId: githubIdSequence,
    githubLogin: `testuser${githubIdSequence}`,
    ...overrides
  };
};

const createTestUser = async (User, userData = {}) => {
  try {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      ...githubIdentity(),
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
  githubIdentity,
  clearDatabase
};
