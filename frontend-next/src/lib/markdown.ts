import { Marked, type RendererObject } from 'marked'
import DOMPurify from 'dompurify'

const renderer: RendererObject = {
  hr() {
    return ''
  },

  image({ href, text }) {
    return `<img src="${href ?? ''}" alt="${text ?? ''}" loading="lazy" onerror="this.style.display='none'" class="chat-img">`
  },

  heading({ text }) {
    // 상태창 감지: 이모지로 시작하거나 대괄호 패턴 포함
    const isStatus = /^[\u{1F4C5}\u{1F5A4}\u{1F90D}\u{1F4AD}\u{1F338}\u{2764}\u{FE0F}\u{1F49B}\u{1F49C}\u{1F525}\u{26A1}\u{1F319}\u{2600}\u{FE0F}\u{1F321}\u{FE0F}\u{1F4CA}]/u.test(text) ||
                     /\[.*?[:：].*?\]/.test(text)

    if (isStatus) {
      const lines = text
        .replace(/\)\s*\[/g, ')\n[')
        .replace(/\]\s*\[/g, ']\n[')
        .split('\n')
        .map((l: string) => l.trim())
        .filter(Boolean)
        .join('<br>')
      return `<div class="status-bar">${lines}</div>`
    }
    return `<p>${text}</p>`
  },

  code({ text }) {
    const isStatus = /━━|📍|🎬|👗|💭|💲|🖤|❤️|💛|💜|🔥|💝|💟/.test(text) ||
                     /\[.+?\].*?[👗💭📍🎬]/.test(text)
    if (isStatus) {
      const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<p>${escaped.replace(/\n/g, '<br>')}</p>`
    }
    return `<pre><code>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  },
}

const marked = new Marked({ renderer, breaks: true, gfm: true })

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text, { async: false })
  return DOMPurify.sanitize(raw)
}

export function replaceTemplateVars(text: string, charName: string, userName = '나'): string {
  return text
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/\{\{char\}\}/gi, charName || '그녀')
}
