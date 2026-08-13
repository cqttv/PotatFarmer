import { createServer, type OutgoingHttpHeaders, type Server } from "node:http";

import { DASHBOARD_HTML } from "./dashboard.js";
import { cache, getEvent, getEvents } from "./db.js";
import { playerInfo, sessionTotals, sessionStart } from "./stats.js";
import { WEB_PORT } from "./config.js";
import { log } from "./logger.js";

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
    const startedAt = Date.now();
    const reqUrl = new URL(req.url ?? "/", "http://localhost");
    const url = reqUrl.pathname;

    if (req.method === "GET" && url === "/") {
      res.writeHead(200, HTML_HEADERS);
      res.end(HTML_BUF);
      log.debug("HTTP request completed", {
        method: req.method,
        path: url,
        status: 200,
        durationMs: Date.now() - startedAt,
      });
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
      log.debug("HTTP request completed", {
        method: req.method,
        path: url,
        status: 200,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    if (req.method === "GET" && url === "/events") {
      const now = Date.now();
      const fromParam = reqUrl.searchParams.get("from");
      const toParam = reqUrl.searchParams.get("to");
      const fromMs = fromParam ? Date.parse(fromParam) : now - 86400000;
      const toMs = toParam ? Date.parse(toParam) : now;
      const from = new Date(Number.isNaN(fromMs) ? now - 86400000 : fromMs);
      const to = new Date(Number.isNaN(toMs) ? now : toMs);
      const events = getEvents(from.toISOString(), to.toISOString());
      const body = JSON.stringify({ events });
      res.writeHead(200, JSON_HEADERS);
      res.end(body);
      log.debug("HTTP request completed", {
        method: req.method,
        path: url,
        status: 200,
        durationMs: Date.now() - startedAt,
        eventCount: events.length,
      });
      return;
    }

    const eventMatch = url.match(/^\/events\/(\d+)$/);
    if (req.method === "GET" && eventMatch?.[1]) {
      const event = getEvent(Number(eventMatch[1]));
      const status = event ? 200 : 404;
      const body = JSON.stringify(
        event ? { event } : { error: "event not found" },
      );
      res.writeHead(status, JSON_HEADERS);
      res.end(body);
      log.debug("HTTP request completed", {
        method: req.method,
        path: url,
        status,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    res.writeHead(404, JSON_HEADERS);
    res.end('{"error":"not found"}');
    log.warn("HTTP route not found", {
      method: req.method,
      path: url,
      status: 404,
    });
  });

  server.on("error", (err: Error) => {
    log.error("HTTP server error", err);
  });

  server.listen(WEB_PORT, () => {
    log.info("Dashboard server listening", { port: WEB_PORT });
  });
  return server;
}
