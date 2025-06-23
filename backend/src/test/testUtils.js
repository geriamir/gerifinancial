const bcrypt = require('bcryptjs');

const createTestUser = async (User) => {
  const hashedPassword = await bcrypt.hash('testpassword', 10);
  const user = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: hashedPassword
  });
  await user.save();
  return user;
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
