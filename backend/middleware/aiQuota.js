const { FEATURES, getPremiumStatus, countUsageThisMonth, recordUsage } = require('../models/premium.model');

let warnedUnavailable = false;

// Put in front of a major AI route: aiQuota('meal_plan').
//  • premium → straight through, nothing counted
//  • free, under the monthly allowance → through, and the use is recorded once
//    the response goes out successfully (a failed or 5xx generation costs
//    nothing, so a flaky AI call never eats someone's free tries)
//  • free, allowance used → 402 with code PREMIUM_REQUIRED, which the app turns
//    into the upgrade popup instead of a generic error
//
// If the premium tables aren't there yet (code deployed before the v26
// migration was run), this fails OPEN so AI features keep working.
function aiQuota(feature) {
  const def = FEATURES[feature];
  if (!def) throw new Error(`aiQuota: unknown feature "${feature}"`);

  return async function aiQuotaMiddleware(req, res, next) {
    try {
      const status = await getPremiumStatus(req.userId);
      if (status.premium) return next();

      const used = await countUsageThisMonth(req.userId, feature);
      if (used >= def.free) {
        return res.status(402).json({
          error: `You've used your ${def.free} free ${def.label} for this month. Premium makes them unlimited.`,
          code: 'PREMIUM_REQUIRED',
          feature, label: def.label, limit: def.free, used,
        });
      }

      res.on('finish', () => {
        if (res.statusCode < 400) {
          recordUsage(req.userId, feature).catch(e => console.error('AI usage record failed:', e.message));
        }
      });
      return next();
    } catch (err) {
      if (!warnedUnavailable) {
        console.warn('Premium checks unavailable (has MIGRATION_minor_v26 been run?) — allowing AI requests:', err.message);
        warnedUnavailable = true;
      }
      return next();
    }
  };
}

module.exports = aiQuota;
