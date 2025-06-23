const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const createTestUser = async (User, userData = {}) => {
  const hashedPassword = await bcrypt.hash('testpassword', 10);
  const user = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: hashedPassword,
    ...userData
  });
  await user.save();

  // Generate token
  const token = jwt.sign(
    { userId: user._id },
    config.jwtSecret,
    { expiresIn: config.jwtExpiration }
  );

  return { user, token };
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
