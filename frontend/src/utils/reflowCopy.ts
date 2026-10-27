// Post-processing for text drag-copied out of the terminal. Agent TUIs render
// decoration (wrap breaks, gutters, blockquote bars) that reads fine on screen
// but copies as literal characters; reflowCopy turns the screen-shaped text
// back into the prose it was rendered from. Inherently heuristic — the caller
// offers a raw-copy escape hatch (Ctrl at mouse release) for the cases it gets
// wrong.

// Claude Code renders a markdown blockquote as a left-block bar glyph ("▎ …")
// at the start of every quoted row. Pure decoration, so it must not survive a
// copy: stripped per physical row BEFORE wrap-joining, or joined rows embed
// bars mid-sentence ("all 343 automated ▎ tests"). Only the left-block family
// is stripped — NOT box-drawing │/┃, which appear as real content in tables
// and tree output.
const QUOTE_BAR = /^[▏▎▍▌▋] ?/

// Strip the gutter: the MOST COMMON indent, not the minimum — bullet
// lines ("● ...") sit at column 0, which would pin a min-based dedent to
// zero and leave every other paragraph indented. Each line loses at most
// the gutter, so deeper indentation (code blocks) keeps its structure.
function stripGutter(lines: string[]): string[] {
  const indentOf = (l: string) => l.length - l.trimStart().length
  const counts = new Map<number, number>()
  for (const l of lines) {
    if (!l.trim()) continue
    counts.set(indentOf(l), (counts.get(indentOf(l)) ?? 0) + 1)
  }
  let gutter = 0
  let best = 0
  for (const [n, c] of counts) {
    if (c > best || (c === best && n < gutter)) {
      gutter = n
      best = c
    }
  }
  return lines.map((l) => l.slice(Math.min(indentOf(l), gutter)))
}

// Agent TUIs hard-wrap their output to the pane width, so wrapped rows
// reach xterm as real newlines plus a gutter indent — copying them raw
// gives mid-sentence line breaks. Reconstruct paragraphs via the word-wrap
// invariant: row B is a continuation of row A iff B's first word could not
// have fit on A. Then strip the indent common to every line (the gutter).
// `rowLengths`, when given, holds the TRUE rendered length of each buffer row
// the selection covers (from term.buffer, trailing blanks trimmed). A
// selection that starts mid-row copies only a fragment of that row, so the
// fragment's length says nothing about whether the ROW wrapped — the buffer
// row's length does. Ignored unless it maps 1:1 onto the copied lines.
export function reflowCopy(text: string, termCols: number, rowLengths?: number[]): string {
  // Agent TUIs wrap a column or two short of the pane width, and JS string
  // length under-counts ambiguous-width chars (em dashes, curly quotes) by
  // a column each — measured live, wrapped rows end up to ~4 columns shy
  // of pane_width. Without this slack, a wrapped row followed by a short
  // word ("an", "to") fails the fit check and keeps its line break.
  const cols = termCols - 4
  const out: string[] = []
  let lastRowLen = 0
  const lines = text.split('\n')
  const trueLengths = rowLengths && rowLengths.length === lines.length ? rowLengths : null
  for (const [i, bare] of lines.entries()) {
    const raw = bare.replace(QUOTE_BAR, '')
    const line = raw.replace(/\s+$/, '')
    const stripped = line.replace(/^\s+/, '')
    const firstWord = stripped.split(/\s/, 1)[0] ?? ''
    if (out.length && stripped && lastRowLen + 1 + firstWord.length > cols) {
      out[out.length - 1] += ' ' + stripped
    } else {
      out.push(line)
    }
    // The wrap check needs the length of the last physical ROW, not the
    // accumulated joined line, or paragraph ends would swallow the next
    // paragraph's first line. And it needs the RENDERED length (quote bar
    // included) — the TUI wrapped at screen width, so judging fit on the
    // bar-stripped content would shrink quoted rows by two columns and eat
    // most of the slack. The buffer row length, when we have it, beats the
    // copied text for the same reason: a mid-row selection start truncates
    // the copy, never the row.
    lastRowLen = Math.max(trueLengths?.[i] ?? 0, bare.replace(/\s+$/, '').length)
  }
  return stripGutter(out).join('\n')
}
