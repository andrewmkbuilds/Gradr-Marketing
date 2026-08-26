/**
 * Post-render open/click instrumentation for opt-in landing emails.
 *
 * Applied to the rendered HTML rather than inside templates so that:
 *  - templates stay declarative and previewable without tracking noise,
 *  - one code path decides what is tracked, and
 *  - the unsubscribe machinery is untouched (the platform appends the footer
 *    after this step, and any link containing `unsubscribe` is skipped).
 *
 * Only https://gradr.me links are rewritten. Support/status subdomains, mailto:
 * links and anything off-brand are left exactly as authored.
 */

const TRACKABLE_LINK = /^https:\/\/(?:[a-z0-9-]+\.)?gradr\.me(?:[/?#]|$)/i

function trackUrl(base: string, messageId: string, type: 'open' | 'click', target?: string): string {
  const params = new URLSearchParams({ m: messageId, t: type })
  if (target) params.set('u', target)
  return `${base.replace(/\/$/, '')}/functions/v1/email-track?${params.toString()}`
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Wrap eligible links and append the open pixel. Never throws. */
export function withEngagementTracking(html: string, messageId: string, supabaseUrl: string): string {
  if (!html || !messageId || !supabaseUrl) return html

  try {
    const rewritten = html.replace(
      /href="([^"]+)"/gi,
      (match, rawHref: string) => {
        const href = rawHref.replace(/&amp;/g, '&')
        if (!TRACKABLE_LINK.test(href)) return match
        // Never wrap links that carry a secret or gate a critical action: the
        // unsubscribe link, the double opt-in confirmation link, and anything
        // with a token must reach the user untouched and must never have its
        // URL recorded as click data.
        if (/unsubscribe|email-track|newsletter\/confirm|token=/i.test(href)) return match
        return `href="${escapeAttr(trackUrl(supabaseUrl, messageId, 'click', href))}"`
      },
    )

    const pixel =
      `<img src="${escapeAttr(trackUrl(supabaseUrl, messageId, 'open'))}" alt="" width="1" height="1" ` +
      `style="display:block;width:1px;height:1px;border:0;opacity:0" />`

    return rewritten.includes('</body>')
      ? rewritten.replace('</body>', `${pixel}</body>`)
      : `${rewritten}${pixel}`
  } catch {
    // Tracking is never worth losing an email over.
    return html
  }
}
