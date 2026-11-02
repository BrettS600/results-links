// Cert Reader - the toolbar popup: how many certs are saved, save / show results.csv, auto-save on or off, clear;
// the GitHub key (card-inbox) and whether the reads have gone to GitHub.
const $ = id => document.getElementById(id);
const msg = t => { $('msg').textContent = t; };

async function refresh() {
  const {records = {}, last = null, lastSave = null, autoSave = true, ghKey = '', outbox = {}, ghStatus = null} =
    await chrome.storage.local.get(['records', 'last', 'lastSave', 'autoSave', 'ghKey', 'outbox', 'ghStatus']);
  $('count').textContent = Object.keys(records).length;
  $('auto').checked = autoSave;
  if (last && records[last.key]) {
    const r = records[last.key];
    const name = r.grader === 'PSA' ? (r.info || {})['Subject'] : (r.info || {})['Card Name'];
    $('last').textContent = 'Last read: ' + r.grader + ' ' + r.cert + (name ? ' - ' + name : '');
  } else $('last').textContent = 'Open a PSA or CGC cert page and it is read by itself.';
  $('saved').textContent = lastSave ? 'results.csv saved ' + new Date(lastSave.at).toLocaleString() + ' (' + lastSave.n + ' certs)' : '';
  const waiting = Object.keys(outbox).length;
  const st = $('ghstate');
  st.className = !ghKey ? 'bad' : ghStatus && !ghStatus.ok ? 'bad' : 'ok';
  st.textContent = !ghKey ? 'No key saved yet - certs are kept here and sent once a key is saved' + (waiting ? ' (' + waiting + ' waiting)' : '') + '.'
    : (ghStatus ? 'Last send ' + new Date(ghStatus.at).toLocaleTimeString() + ': ' + ghStatus.msg : 'Key saved ✓') +
      (waiting && !(ghStatus && /waiting/.test(ghStatus.msg)) ? ' · ' + waiting + ' waiting' : '');
  $('key').placeholder = ghKey ? 'Key saved ✓ (paste a new one to replace it)' : 'Paste your card-inbox key (github_pat_…)';
}

$('auto').onchange = async () => { await chrome.storage.local.set({autoSave: $('auto').checked}); refresh(); };
$('save').onclick = async () => {
  msg('Saving…');
  const r = await chrome.runtime.sendMessage({type: 'save-now'});
  msg(r && r.ok ? (r.id ? 'Saved to Downloads/cert-reader/results.csv' : 'Nothing to save yet') : 'Could not save: ' + (r && r.err));
  refresh();
};
$('show').onclick = async () => {
  const {lastSave = null} = await chrome.storage.local.get('lastSave');
  if (!lastSave) { msg('Not saved yet - press "Save results.csv now".'); return; }
  try { chrome.downloads.show(lastSave.id); } catch (e) { msg('Look in Downloads/cert-reader/'); }
};
let armed = false;
$('clear').onclick = async () => {                // two clicks, so it cannot happen by accident
  if (!armed) { armed = true; $('clear').textContent = 'Click again to clear every saved cert'; setTimeout(() => { armed = false; $('clear').textContent = 'Clear all saved certs…'; }, 4000); return; }
  await chrome.runtime.sendMessage({type: 'clear'});
  armed = false; $('clear').textContent = 'Clear all saved certs…';
  msg('Cleared here. (results.csv on disk is kept until the next save; what was sent to GitHub stays in card-data.)'); refresh();
};
$('savekey').onclick = async () => {
  const k = $('key').value.trim();
  if (!k) { $('ghmsg').textContent = 'Paste the key first.'; return; }
  $('ghmsg').textContent = 'Checking the key…';
  const r = await chrome.runtime.sendMessage({type: 'set-key', key: k});
  $('ghmsg').textContent = r ? r.msg : 'Could not check the key.';
  if (r && r.ok) $('key').value = '';
  setTimeout(refresh, 1500); refresh();
};
$('send').onclick = async () => {
  $('ghmsg').textContent = 'Sending…';
  const r = await chrome.runtime.sendMessage({type: 'send-now'});
  $('ghmsg').textContent = r && r.ok ? (r.err ? 'Not sent: ' + r.err : 'Sent ' + r.sent + (r.left ? ', ' + r.left + ' waiting' : '') + '.') : 'Could not send: ' + (r && r.err);
  refresh();
};
refresh();
