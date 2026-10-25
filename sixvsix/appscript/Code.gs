/**
 * Blackthorn 6v6 bench: a separate, throwaway Apps Script project for testing the simulator inside Apps Script's
 * frame on your phone and laptop. It is not the Blackthorn Canon DB script and never touches that Sheet.
 * It serves the newest file named sixvsix-bench.html from your Drive (read-only), as the web app's page.
 */
var BENCH_FILE = 'sixvsix-bench.html';

function doGet() {
  var it = DriveApp.getFilesByName(BENCH_FILE), newest = null;
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed() && (!newest || f.getLastUpdated() > newest.getLastUpdated())) newest = f;
  }
  if (!newest) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">No ' + BENCH_FILE + ' in your Drive yet. ' +
      'Upload it (from the sixvsix dist/appscript folder), then reload this page.</p>');
  }
  return HtmlService.createHtmlOutput(newest.getBlob().getDataAsString('UTF-8'))
    .setTitle('Blackthorn 6v6 bench')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
