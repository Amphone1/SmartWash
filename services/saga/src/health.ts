/** Minimal HTTP health/metrics endpoints for the saga worker process. */
import { createServer } from 'node:http';
import { collectDefaultMetrics, register } from 'prom-client';
import { config } from './config';

collectDefaultMetrics({ register });

export function startHealthServer(): void {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/health/live' || url === '/health/ready') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'up' }));
      return;
    }
    if (url === '/metrics') {
      register
        .metrics()
        .then((m) => {
          res.writeHead(200, { 'content-type': register.contentType });
          res.end(m);
        })
        .catch(() => {
          res.writeHead(500);
          res.end();
        });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(config.port, () => {
    console.log(`[saga] health on :${config.port}`);
  });
}
