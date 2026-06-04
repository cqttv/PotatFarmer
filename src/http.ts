import { createServer, type OutgoingHttpHeaders, type Server } from "node:http";

import { DASHBOARD_HTML } from "./dashboard.js";
import { cache, getBalanceEvents } from "./db.js";
import { playerInfo, sessionTotals, sessionStart } from "./stats.js";
import { WEB_PORT } from "./config.js";

const JSON_HEADERS: OutgoingHttpHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const HTML_BUF = Buffer.from(DASHBOARD_HTML);
const HTML_HEADERS: OutgoingHttpHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Length": HTML_BUF.length,
};

export function startServer(): Server {
  const server = createServer((req, res) => {
    const reqUrl = new URL(req.url ?? "/", "http://localhost");
    const url = reqUrl.pathname;

    if (req.method === "GET" && url === "/") {
      res.writeHead(200, HTML_HEADERS);
      res.end(HTML_BUF);
      return;
    }

    if (req.method === "GET" && url === "/stats") {
      const body = JSON.stringify({
        player: playerInfo,
        session: { elapsedMs: Date.now() - sessionStart, ...sessionTotals },
        today: cache.today,
        week: cache.week,
        allTime: cache.totals,
      });
      res.writeHead(200, JSON_HEADERS);
      res.end(body);
      return;
    }

    if (req.method === "GET" && url === "/balance-events") {
      const now = Date.now();
      const fromParam = reqUrl.searchParams.get("from");
      const toParam = reqUrl.searchParams.get("to");
      const fromMs = fromParam ? Date.parse(fromParam) : now - 86400000;
      const toMs = toParam ? Date.parse(toParam) : now;
      const from = new Date(Number.isNaN(fromMs) ? now - 86400000 : fromMs);
      const to = new Date(Number.isNaN(toMs) ? now : toMs);
      const body = JSON.stringify({
        events: getBalanceEvents(from.toISOString(), to.toISOString()),
      });
      res.writeHead(200, JSON_HEADERS);
      res.end(body);
      return;
    }

    res.writeHead(404, JSON_HEADERS);
    res.end('{"error":"not found"}');
  });

  server.on("error", (err: Error) => {
    process.stderr.write(`http server error: ${String(err)}\n`);
  });

  server.listen(WEB_PORT);
  return server;
}
