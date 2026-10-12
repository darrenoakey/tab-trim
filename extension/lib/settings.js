// User-tunable limits. Shared by the background worker and the settings page so
// both agree on defaults, bounds and validation messages.

export const SETTINGS = Object.freeze({
  maxTabs: Object.freeze({
    label: 'Maximum open tabs',
    defaultValue: 20,
    min: 1,
    max: 1000,
  }),
  maxDuplicates: Object.freeze({
    label: 'Maximum copies of the same URL',
    defaultValue: 2,
    min: 1,
    max: 100,
  }),
});

export const DEFAULT_SETTINGS = Object.freeze(
  Object.fromEntries(Object.entries(SETTINGS).map(([key, spec]) => [key, spec.defaultValue])),
);

function specFor(key) {
  const spec = SETTINGS[key];
  if (!spec) {
    throw new Error(`unknown setting: ${key}`);
  }
  return spec;
}

function inRange(value, spec) {
  return Number.isInteger(value) && value >= spec.min && value <= spec.max;
}

// Parse a value typed by the user. Returns { value } or { error }.
export function parseSetting(key, text) {
  const spec = specFor(key);
  const trimmed = String(text ?? '').trim();
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (!inRange(value, spec)) {
    return { error: `${spec.label} must be a whole number from ${spec.min} to ${spec.max}.` };
  }
  return { value };
}

// Turn whatever is in storage into a complete, valid settings object. Missing or
// corrupt values fall back to their defaults so enforcement never sees garbage.
export function normalizeSettings(stored) {
  const result = {};
  for (const [key, spec] of Object.entries(SETTINGS)) {
    const value = stored?.[key];
    result[key] = inRange(value, spec) ? value : spec.defaultValue;
  }
  return result;
}
