type TrackProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Pushes an event to `window.dataLayer` (GTM-style) and logs it in development.
 * To plug in GA4 directly, call `window.gtag?.("event", evento, props)` below;
 * for Meta Pixel, call `window.fbq?.("trackCustom", evento, props)`.
 * Never pass personal data (name, email, phone) in `props`.
 */
export function track(evento: string, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: evento, ...props });

  if (process.env.NODE_ENV === "development") {
    console.debug("[track]", evento, props);
  }
}
