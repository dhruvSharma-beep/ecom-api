const { runAlertScan } = require('../services/inventoryAlertService');

const SCAN_INTERVAL_MS = 60 * 60 * 1000; // every hour

let timer = null;

function startWorker(systemUserId) {
  if (timer) return;
  console.log('Stock alert worker started');
  timer = setInterval(async () => {
    try {
      const result = await runAlertScan(systemUserId);
      if (result.created > 0) {
        console.log(`[StockWorker] Created ${result.created} new alerts from ${result.scanned} low-stock products`);
      }
    } catch (err) {
      console.error('[StockWorker] Error during scan:', err.message);
    }
  }, SCAN_INTERVAL_MS);
}

function stopWorker() {
  if (timer) { clearInterval(timer); timer = null; }
  console.log('Stock alert worker stopped');
}

module.exports = { startWorker, stopWorker };
