import { Request, Response, NextFunction } from 'express';
import User from '../models/User.js';
import Entry from '../models/Entry.js';

export function isPankajSuperAdmin(user: any): boolean {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;
  const email = (user.email || '').toLowerCase();
  const name = (user.name || '').toLowerCase();
  return email.includes('pankaj') || name.includes('pankaj');
}

export function getUserSubscriptionInfo(userDoc: any, todayBillCount: number = 0) {
  const now = new Date();

  // Super Admin Check (Pankaj)
  if (isPankajSuperAdmin(userDoc)) {
    return {
      plan: 'superadmin',
      planName: 'Super Admin',
      isUnlimited: true,
      maxDailyBills: Infinity,
      billsCreatedToday: todayBillCount,
      remainingDailyBills: Infinity,
      isSuperAdmin: true,
      status: 'active'
    };
  }

  const sub = userDoc.subscription || {};

  // Check Pro Plan
  if (sub.plan === 'pro' && sub.proEndDate && new Date(sub.proEndDate) > now) {
    const daysLeft = Math.ceil((new Date(sub.proEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      plan: 'pro',
      planName: 'Pro Package (₹299/mo)',
      isUnlimited: true,
      maxDailyBills: Infinity,
      billsCreatedToday: todayBillCount,
      remainingDailyBills: Infinity,
      daysLeft,
      expiresAt: sub.proEndDate,
      isSuperAdmin: false,
      status: 'active'
    };
  }

  // Check Trial Plan
  if (sub.plan === 'trial' && sub.trialEndDate && new Date(sub.trialEndDate) > now) {
    const daysLeft = Math.ceil((new Date(sub.trialEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      plan: 'trial',
      planName: '30-Day Free Trial',
      isUnlimited: true,
      maxDailyBills: Infinity,
      billsCreatedToday: todayBillCount,
      remainingDailyBills: Infinity,
      daysLeft,
      expiresAt: sub.trialEndDate,
      isSuperAdmin: false,
      status: 'active'
    };
  }

  // Free Tier (or Expired Trial/Pro)
  const remaining = Math.max(0, 5 - todayBillCount);
  return {
    plan: 'free',
    planName: 'Free Tier (5 Bills/Day)',
    isUnlimited: false,
    maxDailyBills: 5,
    billsCreatedToday: todayBillCount,
    remainingDailyBills: remaining,
    isSuperAdmin: false,
    status: (sub.plan === 'trial' || sub.plan === 'pro') ? 'expired' : 'active'
  };
}

export async function getTodayBillCount(userId: string, companyName?: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const query: any = {
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  };

  if (userId) {
    query.userId = userId;
  } else if (companyName) {
    query.companyName = companyName;
  }

  return await Entry.countDocuments(query);
}

export async function checkDailyBillLimit(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const todayCount = await getTodayBillCount(userId, userDoc.companyName);
    const subInfo = getUserSubscriptionInfo(userDoc, todayCount);

    if (!subInfo.isUnlimited && todayCount >= 5) {
      return res.status(403).json({
        error: 'DAILY_BILL_LIMIT_EXCEEDED',
        message: 'Daily bill limit reached (5 bills/day). Upgrade to Pro (₹299/mo) or contact Super Admin (Pankaj) for a 30-Day Free Trial.',
        billsCreatedToday: todayCount,
        limit: 5,
        subInfo
      });
    }

    req.subInfo = subInfo;
    next();
  } catch (err: any) {
    console.error('Error checking daily bill limit:', err);
    next();
  }
}
