import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'stream';

// Simple same-origin proxy for ESP32 /capture to avoid CORS-tainted canvas
// NOTE: Adjust the IP if needed or make it configurable via env
const ESP32_IP = '192.168.1.25';
const ESP32_CAPTURE_URL = `http://${ESP32_IP}/capture`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cacheBust = req.query.t ? `?t=${req.query.t}` : '';
    const upstreamUrl = `${ESP32_CAPTURE_URL}${cacheBust}`;

    // Timeout fetch to avoid hanging connections
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    const upstream = await fetch(upstreamUrl, { cache: 'no-store', signal: ac.signal });
    clearTimeout(timeout);
    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
      return;
    }

    // Prevent caching and set proper content type
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Stream body directly to response for lower latency
    const body = upstream.body as unknown as Readable | null;
    if (body) {
      if ((body as any).readable === undefined && typeof (Readable as any).fromWeb === 'function') {
        const nodeStream = (Readable as any).fromWeb(upstream.body as any);
        nodeStream.pipe(res);
      } else {
        body.pipe(res);
      }
    } else {
      // Fallback: read into buffer if no stream (unlikely)
      const arrayBuffer = await upstream.arrayBuffer();
      res.status(200).send(Buffer.from(arrayBuffer));
    }
  } catch (err: any) {
    res.status(500).send(`Proxy error: ${err?.message || 'unknown error'}`);
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};


