import { describe, expect, it } from 'vitest'
import { csvCell, csvRows, toCsv } from './csv.js'

describe('csvCell', () => {
  it('quotes every cell and doubles embedded quotes', () => {
    expect(csvCell('plain')).toBe('"plain"')
    expect(csvCell('say "hi", then\nleave')).toBe('"say ""hi"", then\nleave"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
    expect(csvCell(12.5)).toBe('"12.5"')
  })

  it('quotes only when needed on request', () => {
    const needed = { quote: 'needed' } as const
    expect(csvCell('plain', needed)).toBe('plain')
    expect(csvCell('a,b', needed)).toBe('"a,b"')
    expect(csvCell('a"b', needed)).toBe('"a""b"')
    expect(csvCell('a\r\nb', needed)).toBe('"a\r\nb"')
    expect(csvCell('a\tb', { ...needed, delimiter: '\t' })).toBe('"a\tb"')
    expect(csvCell('a,b', { ...needed, delimiter: '\t' })).toBe('a,b')
  })

  it('serializes objects as JSON and dates as ISO 8601', () => {
    expect(csvCell({ a: 1 }, { quote: 'needed' })).toBe('"{""a"":1}"')
    expect(csvCell(new Date(Date.UTC(2026, 0, 2)), { quote: 'needed' })).toBe('2026-01-02T00:00:00.000Z')
  })

  it('guards text that a spreadsheet would run as a formula', () => {
    for (const text of ['=SUM(A1)', '+1+1', '-1+cmd', '@SUM(A1)', '\tvalue', '\rvalue', '  =HYPERLINK("x")'])
      expect(csvCell(text, { quote: 'needed' }).replace(/^"|"$/g, '')).toMatch(/^'/)
    expect(csvCell('=1', { guardFormulas: false })).toBe('"=1"')
  })

  it('leaves numbers and numeric text unguarded', () => {
    expect(csvCell(-12.5)).toBe('"-12.5"')
    expect(csvCell('-122.75')).toBe('"-122.75"')
    expect(csvCell('+5')).toBe('"+5"')
    expect(csvCell('-1e-3')).toBe('"-1e-3"')
    expect(csvCell('- item')).toBe(`"'- item"`)
  })
})

describe('csvRows', () => {
  it('joins with CRLF and keeps blank and ragged rows', () => {
    expect(csvRows([['Report', 'A'], [], ['Value']])).toBe('"Report","A"\r\n\r\n"Value"')
  })

  it('adds a byte order mark only on request', () => {
    expect(csvRows([['a']], { bom: true })).toBe('\uFEFF"a"')
    expect(csvRows([['a']]).charCodeAt(0)).not.toBe(0xfeff)
  })

  it('accepts other delimiters and newlines', () => {
    expect(
      csvRows(
        [
          ['a', 'b'],
          ['c', 'd'],
        ],
        { delimiter: '\t', newline: '\n', quote: 'needed' },
      ),
    ).toBe('a\tb\nc\td')
  })
})

describe('toCsv', () => {
  it('writes a header and reads object fields by key', () => {
    expect(toCsv(['id', 'name'], [{ id: 1, name: 'North', extra: true }])).toBe('"id","name"\r\n"1","North"')
  })

  it('supports labelled columns with keys or accessors', () => {
    const rows = [{ id: 'a', value: 2 }]
    expect(
      toCsv(
        [
          { header: 'ID', key: 'id' },
          { header: 'Double', value: (row: (typeof rows)[number]) => row.value * 2 },
          { header: 'Index', value: (_row, index) => index },
        ],
        rows,
        { quote: 'needed' },
      ),
    ).toBe('ID,Double,Index\r\na,4,0')
  })

  it('reads array records by position', () => {
    expect(toCsv(['Name', 'Score'], [['North', 1]], { quote: 'needed' })).toBe('Name,Score\r\nNorth,1')
  })

  it('guards formulas and adds a BOM together', () => {
    expect(toCsv(['note'], [{ note: '=cmd' }], { bom: true })).toBe(`\uFEFF"note"\r\n"'=cmd"`)
  })
})
