const { User } = require('../../auth');
const { Transaction } = require('../../banking');
const creditCardDetectionService = require('../../banking/services/creditCardDetectionService');
const scrapingEvents = require('../../banking/services/scrapingEvents');
const logger = require('../../shared/utils/logger');

const DETECTION_WAIT_TIMEOUT_MS = 15 * 60 * 1000;
const DETECTION_LOOKBACK_MONTHS = 2;

class OnboardingCreditCardDetectionService {
  /**
   * Analyse the now-categorised checking transactions and advance onboarding.
   *
   * The expected-step guard prevents a late queue result from moving someone
   * backwards after they have already answered the card question.
   */
  async complete(userId, expectedSteps = ['transaction-import']) {
    const eligibility = {
      _id: userId,
      'onboarding.isComplete': { $ne: true },
      'onboarding.transactionImport.completed': true,
      'onboarding.currentStep': { $in: expectedSteps }
    };

    if (!await User.exists(eligibility)) {
      return null;
    }

    logger.info(`Running credit card detection for user ${userId}`);
    const analysis = await creditCardDetectionService.analyzeCreditCardUsage(
      userId,
      DETECTION_LOOKBACK_MONTHS
    );

    const updatedUser = await User.findOneAndUpdate(
      eligibility,
      {
        $set: {
          'onboarding.creditCardDetection.analyzed': true,
          'onboarding.creditCardDetection.analyzedAt': new Date(),
          'onboarding.creditCardDetection.transactionCount': analysis.transactionCount,
          'onboarding.creditCardDetection.recommendation': analysis.recommendation,
          'onboarding.creditCardDetection.sampleTransactions': analysis.sampleTransactions.slice(0, 5),
          'onboarding.currentStep': 'credit-card-detection'
        }
      },
      { new: true }
    );

    // The user may have answered while the analysis was running.
    if (!updatedUser) {
      logger.info(`Credit card detection finished after onboarding moved on for user ${userId}; leaving the newer step intact`);
      return null;
    }

    logger.info(
      `✅ Onboarding: Credit card detection completed for user ${userId} - ` +
      `recommendation: ${analysis.recommendation}, currentStep: ${updatedUser.onboarding.currentStep}`
    );

    scrapingEvents.emit('credit-card-detection:completed', {
      userId,
      analysis
    });

    return { analysis, user: updatedUser };
  }

  /**
   * Repair the race shipped before detection waited for categorisation.
   *
   * A legitimate zero stays stable: it is only stale when a categorised
   * transaction was written after the zero-result analysis.
   */
  async refreshIfStale(user) {
    const onboarding = user?.onboarding;
    const detection = onboarding?.creditCardDetection;
    const importCompletedAt = onboarding?.transactionImport?.completedAt;

    const categorizationTimedOut =
      onboarding?.currentStep === 'transaction-import' &&
      onboarding?.transactionImport?.completed === true &&
      detection?.analyzed !== true &&
      importCompletedAt &&
      Date.now() - new Date(importCompletedAt).getTime() >= DETECTION_WAIT_TIMEOUT_MS;

    if (categorizationTimedOut) {
      logger.warn(`Credit card detection waited more than 15 minutes for categorization for user ${user._id}; using the transactions available now`);
      return Boolean(await this.complete(user._id, ['transaction-import']));
    }

    if (
      onboarding?.currentStep !== 'credit-card-detection' ||
      detection?.analyzed !== true ||
      detection?.transactionCount !== 0 ||
      !detection?.analyzedAt
    ) {
      return false;
    }

    const detectionStartDate = new Date();
    detectionStartDate.setMonth(detectionStartDate.getMonth() - DETECTION_LOOKBACK_MONTHS);

    const categorizedAfterAnalysis = await Transaction.exists({
      userId: user._id,
      category: { $exists: true, $ne: null },
      date: { $gte: detectionStartDate },
      updatedAt: { $gt: detection.analyzedAt }
    });

    if (!categorizedAfterAnalysis) {
      return false;
    }

    logger.info(`Refreshing stale credit card detection for user ${user._id} after categorization completed`);
    return Boolean(await this.complete(user._id, ['credit-card-detection']));
  }
}

module.exports = new OnboardingCreditCardDetectionService();
