// Time until the next midnight in Athens, when the birthday starts.
// The gift is opened the day before, so "tomorrow" is always the birthday.

const ATHENS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Athens',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

// Athens wall-clock time for `ms`, expressed as if it were UTC.
function wallClock(ms) {
  const p = {};
  for (const { type, value } of ATHENS.formatToParts(ms)) p[type] = Number(value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

export function nextAthensMidnight(now = Date.now()) {
  const today = new Date(wallClock(now));
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
  // Subtract the Athens UTC offset; the second pass settles a DST change in between.
  let t = midnight - (wallClock(midnight) - midnight);
  t = midnight - (wallClock(t) - t);
  return t;
}

export function splitDuration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return { h: Math.floor(total / 3600), m: Math.floor(total / 60) % 60, s: total % 60 };
}
