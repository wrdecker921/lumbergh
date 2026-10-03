import { describe, expect, it } from 'vitest'
import { reflowCopy } from './reflowCopy'

// All fixtures simulate a 40-column pane: rows the TUI hard-wrapped run close
// to 40 rendered columns; deliberate breaks are much shorter.
const COLS = 40

describe('reflowCopy', () => {
  it('joins hard-wrapped rows into one paragraph', () => {
    const text = [
      'The staging environment is now live,', // 36 cols — wrapped
      'and all of the automated tests pass.',
    ].join('\n')
    expect(reflowCopy(text, COLS)).toBe(
      'The staging environment is now live, and all of the automated tests pass.'
    )
  })

  it('keeps deliberate short lines and blank-line paragraph breaks', () => {
    const text = ['First point.', '', 'Second point.'].join('\n')
    expect(reflowCopy(text, COLS)).toBe('First point.\n\nSecond point.')
  })

  it('strips blockquote bars so they cannot end up mid-sentence after a join', () => {
    // Claude Code renders "> quoted" as a ▎ bar glyph before every quoted row.
    const text = [
      '▎ Hey team — the staging environment', // rendered 38 cols — wrapped
      '▎ is running the new build and all',
      '▎ tests are passing as of today.',
      '▎',
      '▎ - Please check your own reports',
      '▎ - Update any saved bookmarks',
    ].join('\n')
    expect(reflowCopy(text, COLS)).toBe(
      [
        'Hey team — the staging environment is running the new build and all tests are passing as of today.',
        '',
        '- Please check your own reports',
        '- Update any saved bookmarks',
      ].join('\n')
    )
  })

  it('judges wrap width by the rendered row, bar included', () => {
    // The quoted row is 38 rendered cols but only 36 after the bar strip;
    // the continuation's first word must still be seen as not fitting.
    const text = ['▎ A quoted sentence that wraps near the', '▎ end.'].join('\n')
    expect(reflowCopy(text, COLS)).toBe('A quoted sentence that wraps near the end.')
  })

  it('leaves box-drawing verticals alone — tables are content, not decoration', () => {
    const text = ['│ name │ port │', '│ lb   │ 8420 │'].join('\n')
    expect(reflowCopy(text, COLS)).toBe('│ name │ port │\n│ lb   │ 8420 │')
  })

  it('dedents by the most common indent, not the minimum', () => {
    const text = [
      '● A bullet at column zero',
      '  prose indented by two',
      '  more indented prose',
    ].join('\n')
    expect(reflowCopy(text, COLS)).toBe(
      '● A bullet at column zero\nprose indented by two\nmore indented prose'
    )
  })
})
