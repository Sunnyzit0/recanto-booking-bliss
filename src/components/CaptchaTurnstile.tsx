import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export type CaptchaTurnstileHandle = { reset: () => void };

type Props = { onToken: (token: string | null) => void };

/**
 * Captcha discreto (Cloudflare Turnstile), opcional: só renderiza algo
 * se VITE_TURNSTILE_SITE_KEY estiver configurada. Sem essa variável,
 * o componente não faz nada e o formulário funciona normalmente — a
 * verificação correspondente no servidor (src/lib/email-actions.ts)
 * também só é exigida quando TURNSTILE_SECRET_KEY está configurada lá.
 */
export const CaptchaTurnstile = forwardRef<CaptchaTurnstileHandle, Props>(function CaptchaTurnstile(
  { onToken },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    if (window.turnstile) {
      setPronto(true);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => setPronto(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!pronto || !SITE_KEY || !containerRef.current || !window.turnstile) return;
    const id = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: "auto",
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
    widgetId.current = id;
    return () => {
      if (window.turnstile) window.turnstile.remove(id);
    };
  }, [pronto, onToken]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="mt-1" />;
});
