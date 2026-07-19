/* Convert family-friendly Airtable labels into stable website keys.
   The patterns intentionally accept common Spanish/English aliases so a
   small wording change in Airtable does not silently remove the value. */
const key = (value) =>
  String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const DRIVETRAIN_PATTERNS = [
  ["differential_lock", /diferencial|differential|locking/],
  ["4x2", /4x2|dos por cuatro|four by two/],
  ["4x4", /4x4|cuatro por cuatro|four by four/],
  ["4wd", /4wd|four wheel drive|traccion en las cuatro/],
  ["awd", /awd|integral|all wheel drive/],
  ["rwd", /rwd|trasera|rear wheel drive/],
  ["fwd", /fwd|delantera|front wheel drive/]
];

export function mapDrivetrain(value) {
  const normalized = key(value);
  if (!normalized) return "";
  const hit = DRIVETRAIN_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  return hit ? hit[0] : "";
}
