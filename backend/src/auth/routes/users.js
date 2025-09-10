const express = require('express');
const router = express.Router();
const User = require('../models/User');
const BankAccount = require('../../banking/models/BankAccount');
const auth = require('../../shared/middleware/auth');

// GET /api/users/onboarding-status
router.get('/onboarding-status', auth, async (req, res) => {
  try {
    // req.user is already the user object from auth middleware
    const user = req.user;

    // Check if user has bank accounts
    const bankAccounts = await BankAccount.find({ userId: user._id });
    const hasCheckingAccount = bankAccounts.some(account => 
      ['hapoalim', 'leumi', 'discount', 'otsarHahayal'].includes(account.bankId)
    );

    // Determine onboarding completion based on current state
    let isComplete = false;
    let completedSteps = [];

    if (hasCheckingAccount) {
      completedSteps.push('checking-account');
    }

    // Check if user has explicit onboarding status
    if (user.onboardingStatus) {
      return res.json({
        isComplete: user.onboardingStatus.isComplete || false,
        hasCheckingAccount: user.onboardingStatus.hasCheckingAccount || hasCheckingAccount,
        completedSteps: user.onboardingStatus.completedSteps || completedSteps,
        creditCardAnalysisResults: user.onboardingStatus.creditCardAnalysisResults
      });
    }

    // For legacy users without onboarding status:
    // If they have a checking account, assume onboarding is complete
    // This maintains backward compatibility with existing users
    isComplete = hasCheckingAccount;
    
    // Return computed status for users without explicit onboarding data
    res.json({
      isComplete,
      hasCheckingAccount,
      completedSteps
    });

  } catch (error) {
    console.error('Error getting onboarding status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/onboarding-status
router.post('/onboarding-status', auth, async (req, res) => {
  try {
    const { 
      isComplete, 
      completedSteps, 
      hasCheckingAccount, 
      hasCreditCards,
      creditCardAnalysisResults 
    } = req.body;

    const updateData = {
      'onboardingStatus.isComplete': isComplete,
      'onboardingStatus.completedSteps': completedSteps,
      'onboardingStatus.hasCheckingAccount': hasCheckingAccount,
      'onboardingStatus.hasCreditCards': hasCreditCards
    };

    if (isComplete) {
      updateData['onboardingStatus.completedAt'] = new Date();
      // Also update the main isComplete field when onboarding is finished
      updateData['isComplete'] = true;
    }

    if (creditCardAnalysisResults) {
      updateData['onboardingStatus.creditCardAnalysisResults'] = creditCardAnalysisResults;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      isComplete: user.onboardingStatus?.isComplete || false,
      hasCheckingAccount: user.onboardingStatus?.hasCheckingAccount || false,
      completedSteps: user.onboardingStatus?.completedSteps || [],
      hasCreditCards: user.onboardingStatus?.hasCreditCards || false,
      creditCardAnalysisResults: user.onboardingStatus?.creditCardAnalysisResults
    });

  } catch (error) {
    console.error('Error updating onboarding status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
