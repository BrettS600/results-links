// Cert Reader - background. Keeps every cert page read (in this Chrome profile, chrome.storage.local), writes them all
// to Downloads/cert-reader/results.csv after each new page (overwriting the last copy), and - once a GitHub key is saved
// in the button - sends each read to card-inbox, from where the hourly ingest files it in card-data
// (data/certs/results.csv). A read that cannot be sent yet (no key, offline) waits and is sent later.
importScripts('csv.js', 'github.js');

const FILE = 'cert-reader/results.csv';
let queue = Promise.resolve(), saveTimer = null;

const get = keys => chrome.storage.local.get(keys);
const badge = n => chrome.action.setBadgeText({text: n ? String(n) : ''});
const later = fn => { queue = queue.then(fn).catch(e => console.warn('cert reader:', e)); return queue; };

async function blobUrl(text) {                     // a service worker cannot make a file link itself; a hidden page can
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Make results.csv to save'});
  }
  const res = await chrome.runtime.sendMessage({type: 'make-blob', text});
  return res.url;
}

async function save(manual) {
  const {records = {}, autoSave = true} = await get(['records', 'autoSave']);
  if (!manual && !autoSave) return null;
  if (!Object.keys(records).length) return null;
  const url = await blobUrl(CertCSV.build(records));
  const id = await chrome.downloads.download({url, filename: FILE, conflictAction: 'overwrite', saveAs: false});
  await chrome.storage.local.set({lastSave: {id, at: new Date().toISOString(), n: Object.keys(records).length}});
  return id;
}

// send the reads waiting in the outbox to card-inbox (the newest read of each cert)
async function sendOutbox() {
  const {records = {}, outbox = {}, ghKey = ''} = await get(['records', 'outbox', 'ghKey']);
  const keys = Object.keys(outbox);
  if (!keys.length) return {sent: 0, left: 0};
  if (!ghKey) { await chrome.storage.local.set({ghStatus: {at: new Date().toISOString(), ok: false, msg: keys.length + ' waiting - no GitHub key saved yet'}}); return {sent: 0, left: keys.length}; }
  let sent = 0, err = '';
  for (const k of keys) {
    const rec = records[k];
    if (!rec) { delete outbox[k]; continue; }
    try {
      const r = await CertGH.send(ghKey, rec);
      if (r.ok) { delete outbox[k]; sent++; }
      else { err = 'GitHub said ' + r.status + (r.status === 401 || r.status === 403 || r.status === 404 ? ' - the key may have expired or lost access to card-inbox' : ''); if (r.status === 401 || r.status === 403) break; }
    } catch (e) { err = 'could not reach GitHub (' + (e.message || e) + ')'; break; }
  }
  const left = Object.keys(outbox).length;
  await chrome.storage.local.set({outbox, ghStatus: {at: new Date().toISOString(), ok: !err, sent, msg: err ? err + (left ? ' - ' + left + ' waiting, tried again every 10 minutes' : '') : 'sent ' + sent + (left ? ', ' + left + ' waiting' : '')}});
  if (left) chrome.alarms.create('send', {delayInMinutes: 10});
  return {sent, left, err};
}

async function addRecord(rec) {
  if (!rec || !rec.cert || !rec.grader) return;
  const {records = {}, outbox = {}} = await get(['records', 'outbox']);
  const key = rec.grader + ':' + rec.cert;
  records[key] = rec;                              // a cert opened again: the newer read replaces the row
  outbox[key] = true;
  await chrome.storage.local.set({records, outbox, last: {key, at: rec.read_at}});
  badge(Object.keys(records).length);
  clearTimeout(saveTimer);                         // the page may still be filling in: save and send once it settles
  saveTimer = setTimeout(() => later(async () => { await save(false); await sendOutbox(); }), 2500);
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type === 'cert') { later(() => addRecord(m.rec)); return; }
  if (m.type === 'save-now') { later(() => save(true)).then(id => reply({ok: true, id}), e => reply({ok: false, err: String(e)})); return true; }
  if (m.type === 'send-now') { later(() => sendOutbox()).then(r => reply(Object.assign({ok: true}, r)), e => reply({ok: false, err: String(e)})); return true; }
  if (m.type === 'set-key') {
    CertGH.check(m.key).then(async r => { if (r.ok) { await chrome.storage.local.set({ghKey: m.key}); later(() => sendOutbox()); } reply(r); },
                             e => reply({ok: false, msg: 'Could not check the key: ' + (e.message || e)}));
    return true;
  }
  if (m.type === 'clear') { later(() => chrome.storage.local.set({records: {}, outbox: {}, last: null})).then(() => { badge(0); reply({ok: true}); }); return true; }
});

chrome.alarms.onAlarm.addListener(a => { if (a.name === 'send') later(() => sendOutbox()); });
chrome.runtime.onStartup.addListener(async () => { const {records = {}} = await get('records'); badge(Object.keys(records).length); later(() => sendOutbox()); });
