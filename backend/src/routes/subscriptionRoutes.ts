import express from 'express';
import User from '../models/User.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import { getUserSubscriptionInfo, getTodayBillCount, isPankajSuperAdmin } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

// Middleware to ensure Pankaj Super Admin access
export const isSuperAdminCheck = async (req: any, res: express.Response, next: express.NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const userDoc = await User.findById(req.user.id);
  if (!userDoc || (!isPankajSuperAdmin(userDoc) && userDoc.role !== 'admin')) {
    return res.status(403).json({ error: 'Super Admin access required (Pankaj only)' });
  }
  next();
};

// GET current user subscription status
router.get('/status', authenticateToken, async (req: any, res) => {
  try {
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    const todayCount = await getTodayBillCount(req.user.id, userDoc.companyName);
    const subInfo = getUserSubscriptionInfo(userDoc, todayCount);

    res.json({
      success: true,
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        companyName: userDoc.companyName,
        role: userDoc.role,
        isSuperAdmin: isPankajSuperAdmin(userDoc)
      },
      subscription: subInfo
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Self-Service Claim 30-Day Free Trial (Restricted to 1 Trial per account)
router.post('/claim-trial', authenticateToken, async (req: any, res) => {
  try {
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    if (userDoc.subscription?.hasClaimedTrial) {
      return res.status(400).json({
        error: 'TRIAL_ALREADY_CLAIMED',
        message: 'Free trial has already been claimed for this account. Each account is eligible for 1 free trial.'
      });
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    userDoc.subscription = {
      ...userDoc.subscription,
      plan: 'trial',
      trialStartDate: now,
      trialEndDate: endDate,
      hasClaimedTrial: true,
      status: 'active'
    };

    await userDoc.save();

    const todayCount = await getTodayBillCount(req.user.id, userDoc.companyName);
    const subInfo = getUserSubscriptionInfo(userDoc, todayCount);

    res.json({
      success: true,
      message: '🎉 30-Day Free Trial activated successfully!',
      subscription: subInfo
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Self-Service Mock Razorpay Checkout (₹299/mo Pro Plan)
router.post('/checkout-pro', authenticateToken, async (req: any, res) => {
  try {
    const { paymentId = `pay_mock_${Date.now()}` } = req.body;
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    userDoc.subscription = {
      ...userDoc.subscription,
      plan: 'pro',
      proStartDate: now,
      proEndDate: endDate,
      status: 'active'
    };

    await userDoc.save();

    const todayCount = await getTodayBillCount(req.user.id, userDoc.companyName);
    const subInfo = getUserSubscriptionInfo(userDoc, todayCount);

    res.json({
      success: true,
      paymentId,
      message: '⚡ Upgraded to Pro Package (₹299/mo) successfully!',
      subscription: subInfo
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET all user subscriptions (Super Admin Panel for Pankaj)
router.get('/admin/list', authenticateToken, isSuperAdminCheck, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });

    const usersWithSub = await Promise.all(
      users.map(async (u: any) => {
        const todayCount = await getTodayBillCount(u._id.toString(), u.companyName);
        const subInfo = getUserSubscriptionInfo(u, todayCount);
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          companyName: u.companyName,
          gstin: u.gstin,
          phone: u.phone,
          isSuperAdmin: isPankajSuperAdmin(u),
          subscriptionRaw: u.subscription,
          subscription: subInfo,
          createdAt: u.createdAt
        };
      })
    );

    res.json({ success: true, users: usersWithSub });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Grant 30-Day Free Trial
router.post('/admin/:userId/grant-trial', authenticateToken, isSuperAdminCheck, async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        $set: {
          'subscription.plan': 'trial',
          'subscription.trialStartDate': now,
          'subscription.trialEndDate': endDate,
          'subscription.status': 'active'
        }
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayCount = await getTodayBillCount(user._id.toString(), user.companyName);
    const subInfo = getUserSubscriptionInfo(user, todayCount);

    res.json({
      success: true,
      message: `Granted ${days}-day free trial successfully to ${user.name}`,
      subscription: subInfo
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Upgrade to Pro Plan (₹299/mo)
router.post('/admin/:userId/upgrade-pro', authenticateToken, isSuperAdminCheck, async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        $set: {
          'subscription.plan': 'pro',
          'subscription.proStartDate': now,
          'subscription.proEndDate': endDate,
          'subscription.status': 'active'
        }
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayCount = await getTodayBillCount(user._id.toString(), user.companyName);
    const subInfo = getUserSubscriptionInfo(user, todayCount);

    res.json({
      success: true,
      message: `Upgraded ${user.name} to Pro Package (₹299/mo) for ${days} days`,
      subscription: subInfo
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reset plan to Free Tier
router.post('/admin/:userId/reset-free', authenticateToken, isSuperAdminCheck, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        $set: {
          'subscription.plan': 'free',
          'subscription.status': 'active'
        }
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayCount = await getTodayBillCount(user._id.toString(), user.companyName);
    const subInfo = getUserSubscriptionInfo(user, todayCount);

    res.json({
      success: true,
      message: `Set ${user.name} to Free Tier`,
      subscription: subInfo
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
