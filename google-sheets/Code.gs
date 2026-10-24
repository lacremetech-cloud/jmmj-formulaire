// Synchronisation Supabase -> Google Sheet (onglet « Réponses »).
// 1. Collez ce fichier dans Extensions > Apps Script, remplacez SHEET_TOKEN.
// 2. Exécutez une fois installerSynchro() et acceptez les autorisations.
// La feuille se met ensuite à jour toutes les 5 minutes.

const SUPABASE_URL = 'https://wmhrpweefutwldbhllhg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wJ1l9a0Iz5S-U-cguQx92Q_2DFTp939';
const SHEET_TOKEN = 'COLLER_ICI_LE_JETON';
const ONGLET = 'Réponses';

const LABELS = {
  cours_hebdo: 'Cours hebdomadaires',
  arabe_intensif: 'Arabe intensif / CPF / Démetrias',
  coran_tajwid: 'Coran / Tajwid / Nouraniya',
  cours_en_ligne: 'Cours en ligne',
};

function synchroJmmj() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/jmmj_sheet_rows', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_KEY },
    payload: JSON.stringify({ p_token: SHEET_TOKEN }),
  });
  const rows = JSON.parse(res.getContentText());
  const labels = (arr) => (arr || []).map((v) => LABELS[v] || v).join(' | ');
  const data = [['Date', 'Nom Prénom', 'Téléphone', 'E-mail', 'Date de naissance', 'Pour soi', 'Pour ses proches', 'Recontact', 'Message']]
    .concat(rows.map((r) => [
      new Date(r.created_at),
      r.nom_prenom,
      r.telephone ? "'" + r.telephone : '',
      r.email || '',
      r.date_naissance ? r.date_naissance.split('-').reverse().join('/') : '',
      labels(r.pour_vous),
      labels(r.pour_proches),
      r.recontact ? 'OUI' : 'NON',
      r.message || '',
    ]));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ONGLET) || ss.insertSheet(ONGLET);
  sheet.clearContents();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  sheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
  sheet.getRange(2, 1, Math.max(data.length - 1, 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.setFrozenRows(1);
}

function installerSynchro() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('synchroJmmj').timeBased().everyMinutes(5).create();
  synchroJmmj();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('JMMJ').addItem('Synchroniser maintenant', 'synchroJmmj').addToUi();
}
