import { normalizeForMatch } from "./matchKeywords";

const MAX_SUGGESTIONS = 16;
const MAX_KEYWORD_LEN = 48;

/** Counterparties that never make a useful keyword. */
const GENERIC_PARTIES = new Set([
  "issuer",
  "notprovided",
  "paypal",
  "paypal europe s a r l et cie s c a",
  "paypal europe s a r l",
]);

/** Payment facilitators — not useful as keywords (would match every SumUp/Zettle tx). */
const PAYFAC = new Set([
  "sumup",
  "zettle",
  "izettle",
  "stripe",
  "square",
  "adyen",
  "mollie",
  "wix",
  "shopify",
  "klarna",
  "payone",
  "logpay",
  "paypal",
]);

const LEGAL_SUFFIXES = new Set([
  "gmbh",
  "ag",
  "se",
  "sa",
  "kg",
  "ug",
  "ohg",
  "co",
  "cie",
  "ltd",
  "inc",
  "bv",
  "pte",
  "llc",
  "plc",
  "limited",
  "ek",
]);

const STOPWORDS = new Set([
  ...LEGAL_SUFFIXES,
  ...PAYFAC,
  "europe",
  "und",
  "and",
  "the",
  "der",
  "die",
  "das",
  "von",
  "vom",
  "mit",
  "fur",
  "für",
  "im",
  "in",
  "auf",
  "zahlung",
  "visa",
  "debitkartenumsatz",
  "einzug",
  "einzugsverfahren",
  "zahlungsrechnung",
  "lastschrift",
  "uberweisung",
  "überweisung",
  "gutschrift",
  "autorisierung",
  "allgemeine",
  "handyzahlung",
  "kartenumsatz",
  "orig",
  "original",
  "city",
  "shop",
  "store",
  "markt",
  "market",
  "group",
  "holding",
  "service",
  "services",
]);

const LEGAL_TAIL_RE =
  /(\s+(&\s+)?co(\.?\s*kg)?|\s+(gmbh|ag|se|kg|ug|ohg|ltd|llc|plc|inc|bv|sa|limited|e\.?\s*k\.?)\.?)+$/i;

const PAYFAC_HEAD_RE =
  /^(sumup|zettle|i-?zettle|stripe|square|adyen|mollie|wix|shopify|klarna|payone|logpay|paypal)\b[\s*._-]*/i;

const GLUED_LEGAL_RE = /(gmbh|ag|ltd|limited|inc|ug|kg|se|bv|llc)$/i;

/** Bank/PayPal templates — never suggested, stripped to find the merchant. */
const PURPOSE_STRIPPERS: RegExp[] = [
  /^visa\s+debitkartenumsatz(\s+vom\s+\d{1,2}\.\d{1,2}\.\d{2,4})?/i,
  /\s+in\s+fremdw[äa]hrung.*$/i,
  /^paypal\s+express-zahlung\s*[·•]\s*/i,
  /^zahlung\s+im\s+einzugsverfahren(\s+mit\s+zahlungsrechnung)?\s*[·•]?\s*/i,
  /^allgemeine\s+(gutschrift(\s+auf\s+kreditkarte)?|autorisierung|zahlung|w[äa]hrungsumrechnung)\s*[·•]?\s*/i,
  /^handyzahlung\s*[·•]\s*/i,
  /^folgelastschrift\s*[·•]?\s*/i,
  /^gutschr\.?\s*ueberw(eisung)?(\.\s*dauerauftr)?\s*[·•]?\s*/i,
  /^entgeltabschluss\s*[·•]?\s*/i,
  /^bargeldauszahlung\s*[·•]?\s*/i,
  /^kartenzahlung\s*[·•]?\s*/i,
  /^svwz\+/i,
];

export type SuggestKeywordFields = {
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
};

/**
 * Keyword candidates from a booking. Prefers Empfänger (card merchants),
 * then leftover purpose after bank templates, then Sender.
 * Existing keywords (already on the target category/sub) are omitted.
 */
export function suggestKeywordsFromTransaction(
  fields: SuggestKeywordFields,
  existingKeywords: string[] = [],
): string[] {
  const seen = new Set(existingKeywords.map((k) => normalizeForMatch(k)));
  const ranked: string[] = [];

  pushParty(ranked, seen, fields.empfaenger);
  pushPurposeRemainder(ranked, seen, fields.verwendungszweck);
  pushParty(ranked, seen, fields.sender);

  return ranked.slice(0, MAX_SUGGESTIONS);
}

function pushParty(out: string[], seen: Set<string>, raw: string) {
  const cleaned = cleanCounterparty(raw);
  if (!cleaned) return;
  pushMerchantVariants(out, seen, cleaned);
}

function pushPurposeRemainder(out: string[], seen: Set<string>, raw: string) {
  const remainder = stripPurposeTemplates(raw);
  if (!remainder) return;
  const head = remainder.split(/[·•]/)[0]?.trim() ?? remainder;
  pushMerchantVariants(out, seen, head);
}

/** Single-word tokens first, then optional two-word phrases. */
function pushMerchantVariants(out: string[], seen: Set<string>, text: string) {
  const withoutLegal = stripLegalSuffixes(text);
  const core = stripPayfacPrefix(withoutLegal);
  const sources = [core, withoutLegal, text].filter(
    (s, i, arr) => s && arr.indexOf(s) === i,
  );

  for (const src of sources) {
    pushSingleTokens(out, seen, src);
  }
  pushBigrams(out, seen, core || withoutLegal);
}

function significantTokens(text: string): string[] {
  const significant: string[] = [];
  const seen = new Set<string>();
  const add = (piece: string, minLen: number) => {
    if (piece.length < minLen) return;
    if (STOPWORDS.has(normalizeForMatch(piece))) return;
    if (PAYFAC.has(normalizeForMatch(piece))) return;
    if (/^\d+$/.test(piece)) return;
    const key = normalizeForMatch(piece);
    if (!key || seen.has(key)) return;
    seen.add(key);
    significant.push(piece);
  };

  for (const raw of tokenize(text)) {
    const peeled = raw.replace(GLUED_LEGAL_RE, "");
    add(peeled, 2);
    add(raw, 2);
    for (const part of splitCamelCase(peeled || raw)) {
      add(part, 3);
    }
  }
  return significant;
}

function pushSingleTokens(out: string[], seen: Set<string>, text: string) {
  for (const token of significantTokens(text)) {
    addCandidate(out, seen, token);
  }
}

function pushBigrams(out: string[], seen: Set<string>, text: string) {
  const tokens = significantTokens(text);
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1]!;
    if (PAYFAC.has(normalizeForMatch(a)) || PAYFAC.has(normalizeForMatch(b))) {
      continue;
    }
    addCandidate(out, seen, `${a} ${b}`);
  }
}

function addCandidate(out: string[], seen: Set<string>, raw: string) {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (isGarbage(cleaned)) return;
  const key = normalizeForMatch(cleaned);
  if (!key || seen.has(key)) return;
  if (STOPWORDS.has(key)) return;
  if (PAYFAC.has(key)) return;
  seen.add(key);
  out.push(cleaned);
}

function isGarbage(raw: string): boolean {
  if (raw.length < 2 || raw.length > MAX_KEYWORD_LEN) return true;
  if (raw.includes("@")) return true;
  const key = normalizeForMatch(raw);
  if (!key || key.length < 2) return true;
  if (GENERIC_PARTIES.has(key)) return true;
  const compact = key.replace(/ /g, "");
  if (/^\d+$/.test(compact)) return true;
  if (!key.includes(" ") && compact.length >= 12 && /^[a-z0-9]+$/i.test(compact)) {
    return true;
  }
  if (/^(eref|mref|cred)\+/i.test(raw)) return true;
  return false;
}

/** "PORTOKALI.DUSHKU.M./THESSALONIKI" → "PORTOKALI DUSHKU M" */
export function cleanCounterparty(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  const slash = s.lastIndexOf("/");
  if (slash > 0) {
    const tail = s.slice(slash + 1).trim();
    if (/^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\- ]{2,}$/.test(tail) && !/\d/.test(tail)) {
      s = s.slice(0, slash);
    }
  }
  const dots = (s.match(/\./g) ?? []).length;
  if (dots >= 2 && !s.includes(" ")) {
    s = s.replace(/\.+/g, " ");
  }
  return s.replace(/\s+/g, " ").trim();
}

export function stripPurposeTemplates(raw: string): string {
  let s = raw.trim();
  let prev = "";
  while (s && s !== prev) {
    prev = s;
    for (const re of PURPOSE_STRIPPERS) {
      s = s.replace(re, "").trim();
    }
  }
  s = s.replace(/^(svwz|eref|mref|cred)\+\S*/gi, "").trim();
  return s.replace(/\s+/g, " ").trim();
}

function stripLegalSuffixes(text: string): string {
  return text.replace(LEGAL_TAIL_RE, "").trim();
}

function stripPayfacPrefix(text: string): string {
  let s = text.trim();
  let prev = "";
  while (s && s !== prev) {
    prev = s;
    s = s.replace(PAYFAC_HEAD_RE, "").trim();
  }
  return s;
}

function tokenize(text: string): string[] {
  return text.split(/[^a-zA-Z0-9äöüÄÖÜß]+/).filter(Boolean);
}

/** "PadelCity" → ["Padel", "City"] (original token is kept separately). */
function splitCamelCase(token: string): string[] {
  if (!/[a-z][A-Z]/.test(token) && !/[A-Z]{2,}[a-z]/.test(token)) return [];
  const parts = token.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  return parts.filter((p) => p.length >= 4);
}
