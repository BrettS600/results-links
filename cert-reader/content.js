// Cert Reader - content script. Runs only on PSA cert pages (psacard.com/cert/...) and CGC cert pages
// (cgccards.com/certlookup/...) that you open yourself. It reads what the page already shows and hands it to the
// extension; it makes no requests and never opens other pages.
// Every label on the page is kept (not a fixed list), so fields only some certs have are saved too.

var CertReader = (() => {
  const t = s => (s || '').replace(/\s+/g, ' ').trim();

  // label/value lists (<dt>Label</dt><dd>Value</dd>) - both PSA's "Item Information" and CGC's details use them
  const pairs = root => {
    const out = {};
    for (const dt of root.querySelectorAll('dt')) {
      const dd = dt.nextElementSibling, k = t(dt.textContent);
      if (k && dd && dd.tagName === 'DD' && !(k in out)) out[k] = t(dd.textContent);
    }
    return out;
  };

  function readPSA() {
    const main = document.querySelector('main') || document.body;
    const info = pairs(main);
    if (!info['Cert Number']) return null;                 // not loaded yet, or not a cert page
    // the summary at the top: Item Grade, PSA Estimate, PSA Population, PSA Pop Higher (and anything else shown there)
    const top = {};
    const stop = [...main.querySelectorAll('h2,h3')].find(e => /Item Information/i.test(t(e.textContent)));
    for (const p of main.querySelectorAll('p')) {
      if (stop && !(p.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const n = p.nextElementSibling, k = t(p.textContent), v = n ? t(n.textContent) : '';
      if (/^[A-Za-z][A-Za-z0-9 /&().'-]{1,40}$/.test(k) && !p.closest('dl,table') && v && v.length < 60 && !(k in top)) top[k] = v;
    }
    const title = [...main.querySelectorAll('h1,h2')].map(e => t(e.textContent)).filter(x => x.length > 15 && !/^#?\d+$/.test(x))[0] || '';
    const images = [...main.querySelectorAll('img')].filter(i => /cert image/i.test(i.alt || '')).map(i => (i.currentSrc || i.src).replace(/\?.*$/, ''));
    // "Sales of Similar Items": one entry per row, keyed by the table's own headings
    const sales = [];
    for (const tb of main.querySelectorAll('table')) {
      const hd = [...tb.querySelectorAll('thead th')].map(x => t(x.textContent));
      for (const tr of tb.querySelectorAll('tbody tr')) {
        const cells = [...tr.children].map(td => [...td.querySelectorAll('p,span,a,div')].filter(e => !e.children.length)
          .map(e => t(e.textContent)).filter(Boolean).join(' ') || t(td.textContent));
        const row = {}; cells.forEach((c, i) => { if (c) row[hd[i] || 'col' + (i + 1)] = c; });
        if (Object.keys(row).length) sales.push(row);
      }
    }
    // other short sections (e.g. Set Registry)
    const other = {};
    for (const e of main.querySelectorAll('h2,h3')) {
      const k = t(e.textContent), n = e.nextElementSibling;
      if (!k || k.length > 40 || k === title || /^#?\d+$/.test(k) || /Item Information|Sales/i.test(k)) continue;   // section names only
      if (n && !n.querySelector('dt,table') && t(n.textContent) && t(n.textContent).length < 300) other[k] = t(n.textContent);
    }
    return {grader: 'PSA', cert: info['Cert Number'], url: location.href, title, top, info, images, sales, other};
  }

  function readCGC() {
    const info = pairs(document.body);
    if (!info['Cert #']) return null;
    // "Total Graded by CGC": In <grade> Grade: n / In Higher Grades: n
    const pop = {};
    for (const el of document.body.querySelectorAll('li,p,div,span,dd,td')) {
      if (el.querySelectorAll('li,p,div').length) continue;
      const m = /^(In [^:]{2,60}):\s*([\d,]+)$/.exec(t(el.textContent));
      if (m && !(m[1] in pop)) pop[m[1]] = m[2];
    }
    const images = [...document.body.querySelectorAll('img')].map(i => (i.currentSrc || i.src).replace(/\?.*$/, '')).filter(u => /imaging/i.test(u));
    return {grader: 'CGC', cert: info['Cert #'], url: location.href, info, pop, images};
  }

  const read = () => (/psacard\.com$/i.test(location.hostname) ? readPSA() : /cgccards\.com$/i.test(location.hostname) ? readCGC() : null);
  return {readPSA, readCGC, read};
})();

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  // The page fills itself in after it loads (PSA's sales table can come a little later), so read it again whenever
  // it changes and send it on only when something new shows up.
  let last = '', timer = null;
  const go = () => {
    let rec = null;
    try { rec = CertReader.read(); } catch (e) { return; }
    if (!rec) return;
    const sig = JSON.stringify(rec);
    if (sig === last) return;
    last = sig;
    rec.read_at = new Date().toISOString();
    chrome.runtime.sendMessage({type: 'cert', rec}).catch(() => {});
  };
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(go, 1200); })
    .observe(document.documentElement, {childList: true, subtree: true, characterData: true});
  setTimeout(go, 1500);
}
