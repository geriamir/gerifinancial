const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const auth = require('../middleware/auth');

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

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
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
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
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
