// Cert Reader - hidden helper page: turns the CSV text into a file link the background can save.
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type !== 'make-blob') return;
  const url = URL.createObjectURL(new Blob([m.text], {type: 'text/csv;charset=utf-8'}));
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  reply({url});
});
