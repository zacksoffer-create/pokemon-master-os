// The phone app has no server: requests to /api/... go to the game engine running in a web worker on the phone.

type Pending = { resolve: (r: Response) => void; reject: (e: any) => void };
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let onProgress: (msg: string) => void = () => {};
let readyResolve: (info: any) => void;
let readyReject: (e: any) => void;
export const ready = new Promise<any>((res, rej) => {
  readyResolve = res;
  readyReject = rej;
});

export function startEngine(progress: (msg: string) => void) {
  onProgress = progress;
  const base = new URL(".", window.location.href);
  worker = new Worker(new URL("engine-worker.js", base));
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === "progress") onProgress(m.text);
    else if (m.type === "ready") readyResolve(m.info);
    else if (m.type === "fatal") readyReject(new Error(m.message));
    else if (m.type === "res") {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      p.resolve(new Response(m.body, { status: m.status, headers: m.headers }));
    }
  };
  worker.onerror = (e) => readyReject(new Error(e.message || "The game engine couldn't start."));
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const path = url.pathname.replace(/^.*?(\/api\/)/, "/api/");
    if (!path.startsWith("/api/") || url.origin !== window.location.origin) return realFetch(input as any, init);
    await ready;
    let body: ArrayBuffer | null = null;
    const b: any = init?.body;
    if (typeof b === "string") body = new TextEncoder().encode(b).buffer as ArrayBuffer;
    else if (b instanceof ArrayBuffer) body = b;
    else if (b instanceof Blob) body = await b.arrayBuffer();
    else if (b && b.buffer instanceof ArrayBuffer) body = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const id = ++seq;
    return new Promise<Response>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker!.postMessage({ type: "req", id, method: (init?.method || "GET").toUpperCase(), path, query: url.search.replace(/^\?/, ""), body },
        body ? [body] : []);
    });
  };
  // save when the app goes to the background (people close phone apps by swiping them away)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") worker?.postMessage({ type: "flush" });
  });
  window.addEventListener("pagehide", () => worker?.postMessage({ type: "flush" }));
}
