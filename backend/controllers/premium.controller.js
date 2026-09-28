const { FEATURES, getPremiumStatus, usageByFeatureThisMonth } = require('../models/premium.model');

// Everything the app needs to draw premium badges and "2 of 3 left" counts.
// enabled:false means the premium tables aren't there yet — the app then shows
// no gating UI at all, matching the middleware failing open.
async function status(req, res) {
  try {
    const s = await getPremiumStatus(req.userId);
    const used = s.premium ? {} : await usageByFeatureThisMonth(req.userId);
    const features = {};
    for (const [key, def] of Object.entries(FEATURES)) {
      const n = used[key] || 0;
      features[key] = {
        label: def.label,
        limit: s.premium ? null : def.free,
        used: n,
        remaining: s.premium ? null : Math.max(0, def.free - n),
      };
    }
    res.json({ enabled: true, ...s, features });
  } catch (err) {
    console.error('Premium status unavailable:', err.message);
    res.json({ enabled: false });
  }
}

module.exports = { status };
