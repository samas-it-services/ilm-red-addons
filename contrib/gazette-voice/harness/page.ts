/** Wraps rendered markup in a page that loads the harness stylesheet. */
export function page(title: string, body: string, opts: { dark?: boolean; width: number; rtl?: boolean }) {
  return `<!DOCTYPE html><html lang="${opts.rtl ? 'ur' : 'en'}" class="${opts.dark ? 'dark' : ''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="stylesheet" href="harness.css"></head><body><main style="max-width:${opts.width}px;margin:0 auto;padding:16px">${body}</main></body></html>`;
}
