/* Convert the Airtable "Transmisión" single-select into a stable website key.
   Like drivetrain.mjs, the patterns accept Spanish/English aliases so a small
   wording change in Airtable does not silently drop the value.
   Airtable options today: "Automática" | "Manual" | empty. */
const key = (value) =>
  String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const TRANSMISSION_PATTERNS = [
  ["automatic", /automatic|automatica|\bcvt\b/],
  ["manual", /manual|estandar|standard|sincronico|stick/]
];

export function mapTransmission(value) {
  const normalized = key(value);
  if (!normalized) return "";
  const hit = TRANSMISSION_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  return hit ? hit[0] : "";
}
