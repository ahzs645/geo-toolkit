export interface CsvOptions {
  /**
   * Prefix text that a spreadsheet would run as a formula (=, +, -, @, tab or
   * carriage return, after optional whitespace) with an apostrophe. Numbers and
   * numeric text are never changed. Defaults to true.
   */
  guardFormulas?: boolean
  /** Start the text with a UTF-8 byte order mark so Excel detects the encoding. Defaults to false. */
  bom?: boolean
  /** Quote every cell, or only cells containing the delimiter, a quote or a line break. Defaults to 'always'. */
  quote?: 'always' | 'needed'
  /** Defaults to ','. */
  delimiter?: string
  /** Defaults to '\r\n', as RFC 4180 specifies. */
  newline?: string
}

/** A header, or a header with the record field or accessor that supplies its cells. */
export type CsvColumn<Row> = string | { header: string; key?: string; value?: (row: Row, index: number) => unknown }

const BOM = '\uFEFF'
const FORMULA = /^(?:[\t\r]|\s*[=+\-@])/
const NUMERIC = /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*$/i

function cellText(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** One serialized cell. Null and undefined are empty; objects are JSON; dates are ISO 8601. */
export function csvCell(value: unknown, options: CsvOptions = {}): string {
  const { guardFormulas = true, quote = 'always', delimiter = ',' } = options
  let text = cellText(value)
  if (
    guardFormulas &&
    typeof value !== 'number' &&
    typeof value !== 'bigint' &&
    FORMULA.test(text) &&
    !NUMERIC.test(text)
  )
    text = `'${text}`
  const needsQuote =
    quote === 'always' || text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r')
  return needsQuote ? `"${text.replace(/"/g, '""')}"` : text
}

/** Serialize rows of cells as given, including blank or ragged rows (report layouts). */
export function csvRows(rows: readonly (readonly unknown[])[], options: CsvOptions = {}): string {
  const { bom = false, delimiter = ',', newline = '\r\n' } = options
  const text = rows.map((row) => row.map((value) => csvCell(value, options)).join(delimiter)).join(newline)
  return bom ? BOM + text : text
}

/**
 * A header row followed by one line per record. A string column reads that
 * field of an object record, or the cell at its position in an array record.
 */
export function toCsv<Row>(columns: readonly CsvColumn<Row>[], rows: readonly Row[], options: CsvOptions = {}): string {
  const cells = (row: Row, index: number) =>
    columns.map((column, position) => {
      if (Array.isArray(row)) return row[position]
      if (typeof column === 'string') return (row as Record<string, unknown>)[column]
      if (column.value) return column.value(row, index)
      return column.key === undefined ? undefined : (row as Record<string, unknown>)[column.key]
    })
  return csvRows(
    [columns.map((column) => (typeof column === 'string' ? column : column.header)), ...rows.map(cells)],
    options,
  )
}
