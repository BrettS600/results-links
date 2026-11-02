// Cert Reader - sending each cert read to GitHub (used by background.js and popup.js).
// The key you paste in the button can only write to your private repo BrettS600/card-inbox (the same kind of key the
// Card Ladder tab uses). Each cert read becomes one small file there, certs/<grader>_<cert>_<time>.json; the hourly
// "Card Ladder ingest" in card-data takes them into data/certs/results.csv and then empties card-inbox.
// The key stays in this extension; PSA's and CGC's pages never see it.

var CertGH = (() => {
  const INBOX = 'BrettS600/card-inbox';
  const API = 'https://api.github.com/repos/' + INBOX;
  const hdr = key => ({Authorization: 'Bearer ' + key, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'});
  const b64 = s => { const b = new TextEncoder().encode(s); let out = ''; for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(out); };

  // check a key: it must see card-inbox and be able to write there (a test file is written and removed again)
  async function check(key) {
    if (!/^(github_pat_|ghp_)\w+$/.test(key || '')) return {ok: false, msg: 'That does not look like a GitHub key (github_pat_…).'};
    const r = await fetch(API, {headers: hdr(key)});
    if (r.status !== 200) return {ok: false, msg: 'GitHub said ' + r.status + ' - check the key was given access to card-inbox.'};
    const u = API + '/contents/checks/cert-reader-' + Date.now() + '.txt';
    const w = await fetch(u, {method: 'PUT', headers: hdr(key), body: JSON.stringify({message: 'cert reader key check', content: btoa('ok')})});
    if (w.status !== 201) return {ok: false, msg: 'The key can see card-inbox but cannot write (GitHub said ' + w.status + '; it needs Contents: Read and write).'};
    const sha = ((await w.json()).content || {}).sha;
    await fetch(u, {method: 'DELETE', headers: hdr(key), body: JSON.stringify({message: 'cert reader key check done', sha})});
    return {ok: true, msg: 'Saved ✓ - certs go to card-inbox'};
  }

  // one cert read -> certs/<grader>_<cert>_<ms>.json in card-inbox; {ok, status}
  async function send(key, rec) {
    const name = String(rec.grader).toLowerCase() + '_' + String(rec.cert).replace(/\D/g, '') + '_' + Date.now() + '.json';
    const r = await fetch(API + '/contents/certs/' + name, {method: 'PUT', headers: hdr(key),
      body: JSON.stringify({message: 'cert ' + rec.grader + ' ' + rec.cert, content: b64(JSON.stringify(rec))})});
    return {ok: r.status === 201, status: r.status, name};
  }

  return {INBOX, check, send};
})();
