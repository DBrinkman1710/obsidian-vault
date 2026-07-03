// Chrome MV3 requires a service worker. This one is minimal —
// all the analysis logic lives in popup.js where it can update the UI directly.
chrome.runtime.onInstalled.addListener(() => {
  console.log('Yippie Inbox Analyser ready');
});
