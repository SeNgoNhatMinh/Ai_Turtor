var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var ALLOWED_HOSTS = /* @__PURE__ */ new Set([
  "docs.oracle.com",
  "developer.mozilla.org",
  "learn.microsoft.com",
  "spring.io",
  "docs.spring.io",
  "docs.python.org",
  "kubernetes.io"
]);
var FETCH_TIMEOUT_MS = 15e3;
var CACHE_MAX_AGE = 3600;
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function htmlResponse(html, extraHeaders = {}) {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}
__name(htmlResponse, "htmlResponse");
function isAllowedHost(hostname) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  for (const allowed of ALLOWED_HOSTS) {
    if (hostname.endsWith(`.${allowed}`)) return true;
  }
  return false;
}
__name(isAllowedHost, "isAllowedHost");
async function handleProxy(request) {
  const requestUrl = new URL(request.url);
  const targetParam = requestUrl.searchParams.get("url");
  if (!targetParam) {
    return jsonResponse(
      { error: 'Missing required "url" query parameter.' },
      400
    );
  }
  let targetUrl;
  try {
    targetUrl = new URL(targetParam);
  } catch {
    return jsonResponse({ error: "Invalid URL format." }, 400);
  }
  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return jsonResponse(
      { error: "Only http and https URLs are supported." },
      400
    );
  }
  if (!isAllowedHost(targetUrl.hostname)) {
    return jsonResponse(
      {
        error: `Domain "${targetUrl.hostname}" is not in the allowed list.`,
        allowed: Array.from(ALLOWED_HOSTS)
      },
      403
    );
  }
  const cache = caches.default;
  const cacheKey = new Request(targetUrl.href, { method: "GET" });
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    const headers = new Headers(cachedResponse.headers);
    Object.entries(CORS_HEADERS).forEach(
      ([key, value]) => headers.set(key, value)
    );
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      headers
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(targetUrl.href, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DocsProxy/1.0; +https://github.com/ai-tutor)",
        Accept: "text/html, application/xhtml+xml"
      },
      signal: controller.signal,
      redirect: "follow"
    });
  } catch (err) {
    if (err.name === "AbortError") {
      return jsonResponse(
        { error: "Upstream request timed out after 15 seconds." },
        504
      );
    }
    return jsonResponse(
      { error: "Failed to fetch the target URL.", details: err.message },
      502
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    return jsonResponse(
      {
        error: `Upstream returned HTTP ${response.status}.`,
        status: response.status
      },
      502
    );
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return jsonResponse(
      {
        error: "The target URL did not return HTML content.",
        contentType
      },
      400
    );
  }
  const html = await response.text();
  const proxyResponse = htmlResponse(html);
  const cacheableResponse = proxyResponse.clone();
  request.ctx?.waitUntil?.(cache.put(cacheKey, cacheableResponse));
  return proxyResponse;
}
__name(handleProxy, "handleProxy");
var src_default = {
  async fetch(request, env, ctx) {
    request.ctx = ctx;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed. Use GET." }, 405);
    }
    const url = new URL(request.url);
    if (url.pathname === "/proxy" || url.pathname === "/proxy/") {
      return handleProxy(request);
    }
    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        service: "docs-cors-proxy",
        allowedDomains: Array.from(ALLOWED_HOSTS)
      });
    }
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ error: "Not found." }, 404);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-8dEgFq/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-8dEgFq/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
