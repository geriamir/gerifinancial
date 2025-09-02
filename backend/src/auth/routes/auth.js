const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../../shared/config/index');
const auth = require('../../shared/middleware/auth');
const { initializeUserCategories } = require('../../shared/services/userCategoryService');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const user = new User({
      email,
      password,
      name
    });

    await user.save();

    // Initialize default categories for the user
    try {
      await initializeUserCategories(user._id);
    } catch (error) {
      console.error('Error initializing user categories:', error);
      // Delete the user if category initialization fails
      await User.findByIdAndDelete(user._id);
      throw new Error('Failed to initialize user categories');
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
