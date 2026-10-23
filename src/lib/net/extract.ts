import { convert } from 'html-to-text'

export interface ExtractedPage {
  title: string
  text: string
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return ''
  return collapseWhitespace(match[1])
}

export function extractPage(html: string): ExtractedPage {
  const title = extractTitle(html)
  const text = convert(html, {
    selectors: [
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'nav', format: 'skip' },
      { selector: 'footer', format: 'skip' },
    ],
    wordwrap: false,
    limits: { maxInputLength: 2_000_000 },
  })

  const collapsed = collapseWhitespace(text)
  const excerpt = collapsed.slice(0, 6000)

  return { title, text: excerpt }
}
