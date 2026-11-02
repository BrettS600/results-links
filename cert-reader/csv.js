// Cert Reader - turns the saved cert pages into the rows of results.csv (used by background.js; plain functions so
// they can be tested on their own).
// One row per cert (PSA and CGC in the same file; opening a cert again replaces its row with the newer read).
// The columns both companies share come first under one name; every other label a page shows gets its own column
// ("PSA Label Type", "CGC Game", ...), added the first time any cert has it.

var CertCSV = (() => {
  const COMMON = ['grader', 'cert', 'card_name', 'year', 'set', 'card_number', 'variety', 'grade', 'pop_this_grade',
                  'pop_higher', 'price_estimate', 'grade_date', 'language', 'picture_front', 'picture_back',
                  'recent_sales', 'title', 'page_url', 'read_at'];
  const PSA_MAP = {'Subject': 'card_name', 'Year': 'year', 'Brand/Title': 'set', 'Card Number': 'card_number',
                   'Variety/Pedigree': 'variety', 'Item Grade': 'grade'};
  const CGC_MAP = {'Card Name': 'card_name', 'Year': 'year', 'Card Set': 'set', 'Card Number': 'card_number',
                   'Variant 1': 'variety', 'Grade': 'grade', 'Grade Date': 'grade_date', 'Language': 'language'};
  const num = v => (/^[\d,]+$/.test(v || '') ? v.replace(/,/g, '') : v);
  const money = v => { const m = /\$?([\d,]+(?:\.\d+)?)/.exec(v || ''); return m ? m[1].replace(/,/g, '') : v; };

  function toRow(rec) {
    const r = {grader: rec.grader, cert: rec.cert, page_url: rec.url,
               read_at: (rec.read_at || '').slice(0, 19).replace('T', ' ') + ((rec.read_at || '') ? ' UTC' : '')};
    const extra = {};
    if (rec.grader === 'PSA') {
      for (const [k, v] of Object.entries(rec.info || {})) {
        if (k === 'Cert Number') continue;
        if (PSA_MAP[k]) r[PSA_MAP[k]] = v; else extra['PSA ' + k] = v;
      }
      for (const [k, v] of Object.entries(rec.top || {})) {
        if (/^item grade$/i.test(k)) continue;                       // same as Item Information's
        if (/^psa population$/i.test(k)) r.pop_this_grade = num(v);
        else if (/pop higher/i.test(k)) r.pop_higher = num(v);
        else if (/estimate/i.test(k)) r.price_estimate = money(v);
        else extra['PSA ' + k] = v;
      }
      r.title = rec.title || '';
      if ((rec.sales || []).length) {                                // price + date, seller + type, cert, eBay lot - then anything else
        const first = ['Sold Price', 'Seller/Type', 'Cert', 'Listing'];
        r.recent_sales = rec.sales.map(s => first.filter(k => s[k]).map(k => s[k])
          .concat(Object.keys(s).filter(k => !first.includes(k)).map(k => s[k])).join(' ')).join('; ');
      }
      for (const [k, v] of Object.entries(rec.other || {})) extra['PSA ' + k] = v;
    } else {
      for (const [k, v] of Object.entries(rec.info || {})) {
        if (k === 'Cert #') continue;
        if (CGC_MAP[k]) r[CGC_MAP[k]] = v; else extra['CGC ' + k] = v;
      }
      for (const [k, v] of Object.entries(rec.pop || {})) {
        if (/^In Higher/i.test(k)) r.pop_higher = num(v);
        else if (/^In .+ Grade$/i.test(k)) r.pop_this_grade = num(v);
        else extra['CGC Pop ' + k] = num(v);
      }
    }
    const im = rec.images || [];
    if (im[0]) r.picture_front = im[0];
    if (im[1]) r.picture_back = im[1];
    return {row: r, extra};
  }

  const esc = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  // all saved pages -> the text of results.csv (oldest read first)
  function build(records) {
    const recs = Object.values(records || {}).sort((a, b) => String(a.read_at).localeCompare(String(b.read_at)));
    const extraCols = [], rows = [];
    for (const rec of recs) {
      const {row, extra} = toRow(rec);
      for (const k of Object.keys(extra)) if (!extraCols.includes(k)) extraCols.push(k);
      rows.push(Object.assign(row, extra));
    }
    const cols = COMMON.concat(extraCols);
    return '﻿' + [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n') + '\r\n';
  }

  return {COMMON, toRow, build};
})();
if (typeof module !== 'undefined') module.exports = CertCSV;
