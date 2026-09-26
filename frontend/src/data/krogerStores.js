// Kroger's Cart API covers every banner in the Kroger family, and one Kroger
// login works across all of them. Worth spelling out wherever we ask someone to
// connect, because most people know their local banner's name, not "Kroger".
// Kept in one place so the Meals page and Settings can't drift apart.
export const KROGER_BANNERS = [
  'Ralphs', 'Fred Meyer', 'King Soopers', "Smith's", "Fry's", 'Dillons', 'QFC',
  'City Market', 'Harris Teeter', "Pick 'n Save", 'Metro Market', "Mariano's",
  "Baker's", 'Gerbes', 'Jay C', 'Pay Less', 'Food 4 Less', 'Foods Co',
];

// Short form for tight spaces.
export const KROGER_BANNERS_SHORT = KROGER_BANNERS.slice(0, 6);

export function krogerBannerSentence() {
  return `One Kroger account works at all of them: ${KROGER_BANNERS.join(', ')}.`;
}
