// Export CSV des réponses pour Google Sheets : =IMPORTDATA(".../api/sheet?token=...")
// Le jeton est vérifié par la base (public.jmmj_sheet_rows), jamais stocké ici.

const SUPABASE_URL = "https://wmhrpweefutwldbhllhg.supabase.co";
const SUPABASE_KEY = "sb_publishable_wJ1l9a0Iz5S-U-cguQx92Q_2DFTp939";

const LABELS = {
  cours_hebdo: "Cours hebdomadaires",
  arabe_intensif: "Arabe intensif / CPF / Démetrias",
  coran_tajwid: "Coran / Tajwid / Nouraniya",
  cours_en_ligne: "Cours en ligne",
};

const dateFr = (iso) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })
    .format(new Date(iso));

// Espaces dans le numéro : Sheets le garde en texte (sinon « +33… » devient un nombre).
const phone = (t) => {
  if (!t) return "";
  if (t.startsWith("+33") && t.length === 12) return "+33 " + t.slice(3, 4) + " " + t.slice(4).match(/.{2}/g).join(" ");
  if (/^0\d{9}$/.test(t)) return t.match(/.{2}/g).join(" ");
  return t.startsWith("+") ? t.slice(0, 3) + " " + t.slice(3) : t;
};

const cell = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

module.exports = async function handler(req, res) {
  const token = req.query.token;
  if (!token) return res.status(401).send("jeton manquant");

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/jmmj_sheet_rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) return res.status(r.status === 400 || r.status === 401 ? 401 : 502).send("accès refusé");
  const rows = await r.json();

  const labels = (arr) => (arr || []).map((v) => LABELS[v] || v).join(" | ");
  const lines = [
    ["Date", "Nom Prénom", "Téléphone", "E-mail", "Date de naissance", "Intérêts", "Recontact", "Message"],
    ...rows.map((x) => [
      dateFr(x.created_at),
      x.nom_prenom,
      phone(x.telephone),
      x.email,
      x.date_naissance ? x.date_naissance.split("-").reverse().join("/") : "",
      labels(x.pour_vous),
      x.recontact ? "OUI" : "NON",
      x.message || "",
    ]),
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(lines.map((l) => l.map(cell).join(",")).join("\n"));
};
