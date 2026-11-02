# Cert Reader (PSA + CGC)

A small Chrome extension. Whenever **you** open a PSA cert page (`psacard.com/cert/...`) or a CGC cert page
(`cgccards.com/certlookup/...`), it reads what the page shows and saves it to **one file**:

    Downloads/cert-reader/results.csv

and, once a GitHub key is saved in its button, sends it to GitHub, where it lands in **card-data's
`data/certs/results.csv`** and fills the site's Auth columns.

- PSA and CGC certs go in the same file, one row per cert. Opening a cert again replaces its row with the newer read.
- The file is rewritten after each new page, so there is always just the one results.csv (no "results (1).csv").
- It only reads the page already on your screen. It makes no requests to PSA or CGC and never opens other pages.

## Install (once)

1. Unzip `cert-reader.zip` somewhere you will keep it (for example `Documents/cert-reader`). Chrome loads it from
   that folder, so don't delete it afterwards.
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `cert-reader` folder.
5. Optional: click the puzzle-piece icon in the toolbar and pin **Cert Reader** so its button is always visible.

Then open any PSA or CGC cert page. After a few seconds the Cert Reader button shows how many certs are saved, and
`Downloads/cert-reader/results.csv` is updated.

If Chrome asks where to save each time, turn off **Settings → Downloads → "Ask where to save each file before
downloading"**, or untick "Save results.csv after each page" in the button and press "Save results.csv now" when you
want the file.

## Send to GitHub (once)

The extension sends each cert it reads to your private repo **card-inbox** (the same drop box the Card Ladder run
uses). The hourly "Card Ladder ingest" in card-data takes them into `data/certs/results.csv` - one row per cert, PSA
and CGC together, with the same columns as the local file - and the site's next build fills the Auth columns (Auth Name,
Set, Card No., Release, Language, Grade, Label, Pop, Pop Higher, Estimate) for every row whose Auth Cert is a cert you
opened.

1. Make a GitHub key that can only write to card-inbox: GitHub → Settings → Developer settings → Personal access
   tokens → **Fine-grained tokens** → Generate new token. Name it e.g. "cert reader", Repository access: **Only select
   repositories → card-inbox**, Permissions → Repository permissions → **Contents: Read and write**. Generate and copy it.
   (Make a new one rather than reusing the Card Ladder tab's key, so either can be replaced on its own.)
2. Click the Cert Reader button, paste the key in **GitHub (card-data's results.csv)** and press **Save key**. It is
   checked (a test file is written to card-inbox and removed) and then kept in this extension only - PSA's and CGC's
   pages never see it.

Certs read before the key was saved are kept and sent as soon as it is. If GitHub cannot be reached, they wait and are
tried again every 10 minutes (or press **Send waiting certs now**). The button shows when the last send happened.

When it shows up: card-inbox at once; card-data's results.csv after the next ingest run (GitHub runs the hourly
schedule late at times - often every few hours); the site after its next build (every morning, or press Run workflow
on the site's Actions page).

## The button

- How many certs are saved and the last one read.
- **Save results.csv after each page** (on by default).
- **Save results.csv now**.
- **Show results.csv in its folder**.
- **Clear all saved certs** (click twice). This empties the extension's list; the results.csv already on disk stays
  until the next save, and what was already sent to GitHub stays in card-data.
- **GitHub**: whether a key is saved, the last send, how many certs are waiting; **Save key**; **Send waiting certs now**.

## The columns

The columns PSA and CGC share come first, under one name:

| column | PSA field | CGC field |
|---|---|---|
| grader | PSA | CGC |
| cert | Cert Number | Cert # |
| card_name | Subject | Card Name |
| year | Year | Year |
| set | Brand/Title | Card Set |
| card_number | Card Number | Card Number |
| variety | Variety/Pedigree | Variant 1 |
| grade | Item Grade | Grade |
| pop_this_grade | PSA Population | Total Graded by CGC: In <grade> Grade |
| pop_higher | PSA Pop Higher | Total Graded by CGC: In Higher Grades |
| price_estimate | PSA Estimate | - |
| grade_date | - | Grade Date |
| language | - | Language |
| picture_front, picture_back | the slab pictures (links) | the slab pictures (links) |
| recent_sales | Sales of Similar Items (price, date, seller, type, cert, eBay lot) | - |
| title | the page's full title | - |
| page_url, read_at | the page and when it was read (UTC) | same |

**Every other label a page shows gets its own column**, named after the company and the label: `PSA Label Type`,
`PSA Reverse Cert/Barcode`, `PSA Category`, `PSA Set Registry`, `CGC Game`, and anything that only some certs have
(an autograph grade, a "Variant 2", ...). A new column is added the first time any cert has that label; certs without
it are blank there. Nothing on the page is dropped because the list of fields is not fixed.

Pictures are saved as links, not as image files, so the file stays small (about 1 KB per cert).

## Where the data lives

- The list of every cert read is kept inside Chrome (this profile), and `results.csv` is rebuilt from it each time.
- Removing the extension deletes that list (the results.csv on disk stays). Keep a copy of results.csv before
  removing or reinstalling it.

## Files

- `manifest.json` - the extension's settings (which pages it runs on, what it may do: storage, downloads, and
  talking to api.github.com).
- `content.js` - reads a PSA or CGC cert page (every `<dt>`/`<dd>` label, PSA's summary numbers and sales table,
  CGC's population lines, the slab picture links).
- `csv.js` - turns the saved pages into the rows and columns of results.csv.
- `background.js` - keeps the saved pages, writes results.csv and sends each read to card-inbox; `offscreen.html` /
  `offscreen.js` help it make the file.
- `github.js` - checking the key and sending a read to card-inbox (`certs/<grader>_<cert>_<time>.json`).
- `popup.html` / `popup.js` - the toolbar button.

## Updating from an earlier version

Replace the files in your `cert-reader` folder with the new ones, then press the round-arrow **reload** button on the
Cert Reader card in `chrome://extensions`. The certs already saved stay.
