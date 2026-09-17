// Parses a free-text recipe ingredient line ("2 cups chicken breast, diced")
// into the structured { name, quantity, unit } shape Instacart's shopping
// list API expects, so it can actually match the right quantity instead of
// just searching by product name.
//
// Units are limited to what's confirmed on Instacart's own reference page:
// https://docs.instacart.com/developer_platform_api/api/units_of_measurement
// Sending a unit outside that list makes Instacart's quantity matching fail
// for that item, so anything not recognized here is left unit-less on
// purpose (falls back to name-only matching) rather than guessed at.
const UNIT_MAP = [
  { match: /^(cups?|c)$/i, unit: 'cup' },
  { match: /^(tablespoons?|tbsp\.?|tbs\.?|tbl\.?|tb\.?)$/i, unit: 'tbs' },
  { match: /^(teaspoons?|tsp\.?|tspn\.?|ts\.?)$/i, unit: 'tsp' },
  { match: /^(fl\.?\s?oz\.?|fluid\s?ounces?)$/i, unit: 'fl oz ounce' },
  { match: /^(gallons?|gal\.?|gals\.?)$/i, unit: 'gallon' },
  { match: /^(milliliters?|millilitres?|ml\.?|mls\.?)$/i, unit: 'milliliter' },
  { match: /^(liters?|litres?)$/i, unit: 'liter' }, // bare "l" excluded — too easy to false-match
  { match: /^(pints?|pt\.?|pts\.?)$/i, unit: 'pint' },
  { match: /^(quarts?|qt\.?|qts\.?)$/i, unit: 'quart' },
  { match: /^(grams?|gs?)$/i, unit: 'gram' },
  { match: /^(kilograms?|kgs?)$/i, unit: 'kilogram' },
  { match: /^(pounds?|lbs?)$/i, unit: 'pound' },
  { match: /^(ounces?|oz\.?)$/i, unit: 'ounce' },
  { match: /^(cans?)$/i, unit: 'can' },
  { match: /^(bunch(?:es)?)$/i, unit: 'bunch' },
  { match: /^(heads?)$/i, unit: 'head' },
  { match: /^(packages?|pkgs?)$/i, unit: 'package' },
  { match: /^(large|lrg|lge|lg)$/i, unit: 'large' },
  { match: /^(medium|med|md)$/i, unit: 'medium' },
  { match: /^(small|sm)$/i, unit: 'small' },
];

function matchUnit(word) {
  if (!word) return null;
  const hit = UNIT_MAP.find(u => u.match.test(word.trim()));
  return hit ? hit.unit : null;
}

// Recipe-only measurement words with no Instacart equivalent — stripped
// from the product name same as a real unit, but never sent as `unit`
// itself (falls through to the "each" default below instead).
const NON_INSTACART_WORD = /^(slices?|pieces?|sticks?|fillets?|strips?|cloves?|sprigs?|stalks?|pinch(?:es)?|dash(?:es)?|handfuls?|knobs?)$/i;


function parseNumber(s) {
  if (!s) return null;
  if (s.includes('/')) {
    // Handles both a bare fraction ("1/2") and a mixed number ("1 1/2")
    const parts = s.trim().split(/\s+/);
    let total = 0;
    for (const p of parts) {
      if (p.includes('/')) {
        const [n, d] = p.split('/').map(Number);
        if (d) total += n / d;
      } else {
        total += Number(p);
      }
    }
    return total;
  }
  return Number(s);
}

export function parseIngredientForInstacart(ingredient) {
  let text = ingredient.trim();
  let quantity = null;

  // Leading quantity: a plain number, a fraction, a mixed number, or a
  // range ("2-3") — ranges take the higher end, so the list always errs
  // toward "at least this much" rather than coming up short.
  const qtyMatch = text.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)(?:\s*-\s*(\d+(?:\.\d+)?))?\s+/);
  if (qtyMatch) {
    const low = parseNumber(qtyMatch[1]);
    const high = qtyMatch[2] ? Number(qtyMatch[2]) : null;
    quantity = high != null ? Math.max(low, high) : low;
    text = text.slice(qtyMatch[0].length);
  }

  // Leading unit word, now that any quantity has already been stripped —
  // done as its own step so it can't run past a word boundary into the name.
  let unit = null;
  const unitMatch = text.match(/^([a-zA-Z.]+)\s+/);
  if (unitMatch) {
    const word = unitMatch[1];
    const mapped = matchUnit(word);
    if (mapped) {
      unit = mapped;
      text = text.slice(unitMatch[0].length);
    } else if (NON_INSTACART_WORD.test(word)) {
      // Not a unit Instacart accepts, but still not part of the food name —
      // strip it and let the "each" fallback below cover the measurement.
      text = text.slice(unitMatch[0].length);
    }
  }

  // Drop trailing prep notes / parentheticals — not useful for matching a
  // shelf product, and sometimes actively misleading (e.g. "93% lean").
  const name = text.split(',')[0].replace(/\([^)]*\)/g, '').trim() || ingredient.trim();

  // A quantity with no recognized unit word (e.g. "3 eggs", "2 bananas") —
  // Instacart's own docs recommend "each" for countable items like this
  // rather than leaving it unit-less.
  if (quantity != null && !unit) unit = 'each';

  return { name, quantity: quantity ?? undefined, unit: unit ?? undefined };
}
