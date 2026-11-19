export type XlsxCellFormat =
  | 'text'
  | 'header'
  | 'title'
  | 'subtitle'
  | 'currency'
  | 'integer'
  | 'percent'
  | 'boldText'
  | 'boldCurrency'
  | 'boldInteger'
  | 'boldPercent'

export type XlsxPrimitive = string | number | boolean | null | undefined

export interface XlsxStyledCell {
  value: XlsxPrimitive
  format?: XlsxCellFormat
}

export type XlsxCell = XlsxPrimitive | XlsxStyledCell

export interface XlsxSheet {
  name: string
  rows: XlsxCell[][]
  /** 1-based row number to freeze (freezes rows 1..N). */
  freezeHeaderRow?: number
  /** 1-based row number where Excel AutoFilter dropdowns are placed. */
  autoFilterRow?: number
  /** Optional explicit column widths (in Excel character units). */
  colWidths?: number[]
}

const STYLE_INDEX: Record<XlsxCellFormat, number> = {
  text: 0,
  header: 1,
  title: 2,
  subtitle: 3,
  currency: 4,
  integer: 5,
  percent: 6,
  boldText: 7,
  boldCurrency: 8,
  boldInteger: 9,
  boldPercent: 10,
}

const UTF8_ENCODER = new TextEncoder()

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function stripInvalidXmlChars(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
}

function escapeXml(input: string): string {
  return stripInvalidXmlChars(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toColumnName(indexZeroBased: number): string {
  let n = indexZeroBased + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function sanitizeSheetName(rawName: string, usedNames: Set<string>): string {
  const cleaned = stripInvalidXmlChars(rawName)
    .replace(/[:\\/?*\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const base = (cleaned || 'Sheet').slice(0, 31).trim() || 'Sheet'

  if (!usedNames.has(base.toLowerCase())) {
    usedNames.add(base.toLowerCase())
    return base
  }

  let counter = 2
  while (counter < 1000) {
    const suffix = ` (${counter})`
    const candidate = `${base.slice(0, 31 - suffix.length).trim()}${suffix}`
    if (!usedNames.has(candidate.toLowerCase())) {
      usedNames.add(candidate.toLowerCase())
      return candidate
    }
    counter += 1
  }

  return `Sheet_${usedNames.size + 1}`.slice(0, 31)
}

function normalizeCell(cell: XlsxCell): XlsxStyledCell {
  if (cell !== null && typeof cell === 'object' && 'value' in cell) {
    return cell
  }
  return { value: cell }
}

function estimateDisplayLength(cell: XlsxStyledCell): number {
  const { value, format } = cell
  if (value === null || value === undefined) return 0
  if (typeof value === 'boolean') return value ? 3 : 2
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0
    if (format === 'currency' || format === 'boldCurrency') {
      return `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.length + 2
    }
    if (format === 'percent' || format === 'boldPercent') {
      return `${(value * 100).toFixed(1)}%`.length + 1
    }
    return value.toLocaleString('en-US').length + 1
  }
  const text = String(value)
  const longestLine = text.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0)
  if (format === 'title') return Math.min(longestLine, 36)
  if (format === 'subtitle') return Math.min(longestLine, 36)
  return longestLine + (format === 'header' ? 3 : 1)
}

function computeColumnWidths(rows: XlsxStyledCell[][], overrides?: number[]): number[] {
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const widths: number[] = []

  for (let c = 0; c < colCount; c++) {
    if (overrides && typeof overrides[c] === 'number' && overrides[c] > 0) {
      widths.push(overrides[c])
      continue
    }

    let maxLen = 10
    for (let r = 0; r < rows.length; r++) {
      const cell = rows[r]?.[c]
      if (!cell) continue
      // Skip wide title/subtitle banner cells in column A so they don't bloat col A width
      if (c === 0 && (cell.format === 'title' || cell.format === 'subtitle')) {
        continue
      }
      const len = estimateDisplayLength(cell)
      if (len > maxLen) {
        maxLen = len
      }
    }
    widths.push(Math.min(Math.max(maxLen + 2, 10), 46))
  }

  return widths
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="&quot;₱&quot;#,##0.00"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
    <numFmt numFmtId="166" formatCode="0.0%"/>
  </numFmts>
  <fonts count="5">
    <font>
      <sz val="11"/>
      <color rgb="FF1F2937"/>
      <name val="Calibri"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FFFFFFFF"/>
      <name val="Calibri"/>
    </font>
    <font>
      <b/>
      <sz val="14"/>
      <color rgb="FF1F2937"/>
      <name val="Calibri"/>
    </font>
    <font>
      <sz val="10"/>
      <color rgb="FF6B7280"/>
      <name val="Calibri"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FF1F2937"/>
      <name val="Calibri"/>
    </font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9E4C6D"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDF2F6"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FF9E4C6D"/></top>
      <bottom style="double"><color rgb="FF9E4C6D"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="11">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="4" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="165" fontId="4" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="166" fontId="4" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`
}

function buildWorksheetXml(sheet: XlsxSheet): string {
  const normalizedRows = sheet.rows.map((row) => row.map(normalizeCell))
  const colWidths = computeColumnWidths(normalizedRows, sheet.colWidths)
  const colCount = colWidths.length
  const rowCount = normalizedRows.length

  const sheetViewInner =
    sheet.freezeHeaderRow && sheet.freezeHeaderRow > 0
      ? `<pane ySplit="${sheet.freezeHeaderRow}" topLeftCell="A${sheet.freezeHeaderRow + 1}" activePane="bottomLeft" state="frozen"/>`
      : ''

  const colsXml =
    colCount > 0
      ? `<cols>${colWidths
          .map(
            (width, idx) =>
              `<col min="${idx + 1}" max="${idx + 1}" width="${width.toFixed(1)}" customWidth="1"/>`,
          )
          .join('')}</cols>`
      : ''

  const rowsXml = normalizedRows
    .map((row, rowIdx) => {
      const rowNum = rowIdx + 1
      const isHeader = row.some((c) => c.format === 'header')
      const isTitle = row.some((c) => c.format === 'title')
      const rowHeight = isTitle ? 26 : isHeader ? 24 : 20

      const cellsXml = row
        .map((cell, colIdx) => {
          const ref = `${toColumnName(colIdx)}${rowNum}`
          const format = cell.format ?? 'text'
          const styleIdx = STYLE_INDEX[format] ?? 0
          const val = cell.value

          if (val === null || val === undefined || val === '') {
            if (format === 'text' || format === 'title' || format === 'subtitle') {
              return ''
            }
            return `<c r="${ref}" s="${styleIdx}"/>`
          }

          if (typeof val === 'number') {
            if (!Number.isFinite(val)) {
              return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t></t></is></c>`
            }
            return `<c r="${ref}" s="${styleIdx}" t="n"><v>${val}</v></c>`
          }

          if (typeof val === 'boolean') {
            return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t>${val ? 'Yes' : 'No'}</t></is></c>`
          }

          const escaped = escapeXml(String(val))
          return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escaped}</t></is></c>`
        })
        .filter(Boolean)
        .join('')

      return `<row r="${rowNum}" ht="${rowHeight}" customHeight="1">${cellsXml}</row>`
    })
    .join('')

  const autoFilterXml =
    sheet.autoFilterRow &&
    sheet.autoFilterRow > 0 &&
    colCount > 0 &&
    rowCount >= sheet.autoFilterRow
      ? `<autoFilter ref="A${sheet.autoFilterRow}:${toColumnName(colCount - 1)}${rowCount}"/>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView workbookViewId="0">${sheetViewInner}</sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
  ${autoFilterXml}
</worksheet>`
}

interface ZipEntryInput {
  path: string
  data: Uint8Array
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear())
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f)
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f)
  return { dosTime, dosDate }
}

function buildZipArchive(entries: ZipEntryInput[]): Uint8Array {
  const { dosTime, dosDate } = getDosDateTime(new Date())
  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const nameBytes = UTF8_ENCODER.encode(entry.path)
    const data = entry.data
    const crc = crc32(data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(localHeader.buffer)
    lv.setUint32(0, 0x04034b50, true) // Local file header signature
    lv.setUint16(4, 20, true) // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true) // UTF-8 filename flag
    lv.setUint16(8, 0, true) // Compression method: 0 (STORE)
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // Extra field length
    localHeader.set(nameBytes, 30)

    localChunks.push(localHeader, data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(centralHeader.buffer)
    cv.setUint32(0, 0x02014b50, true) // Central directory header signature
    cv.setUint16(4, 20, true) // Version made by
    cv.setUint16(6, 20, true) // Version needed to extract
    cv.setUint16(8, 0x0800, true) // UTF-8 filename flag
    cv.setUint16(10, 0, true) // Compression method: 0 (STORE)
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true) // Extra field length
    cv.setUint16(32, 0, true) // File comment length
    cv.setUint16(34, 0, true) // Disk number start
    cv.setUint16(36, 0, true) // Internal file attributes
    cv.setUint32(38, 0, true) // External file attributes
    cv.setUint32(42, localOffset, true)
    centralHeader.set(nameBytes, 46)

    centralChunks.push(centralHeader)
    localOffset += localHeader.length + data.length
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true) // End of central directory signature
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, localOffset, true)
  ev.setUint16(20, 0, true)

  const totalSize = localOffset + centralSize + eocd.length
  const output = new Uint8Array(totalSize)
  let cursor = 0
  for (const chunk of localChunks) {
    output.set(chunk, cursor)
    cursor += chunk.length
  }
  for (const chunk of centralChunks) {
    output.set(chunk, cursor)
    cursor += chunk.length
  }
  output.set(eocd, cursor)

  return output
}

/**
 * Generates an OpenXML (.xlsx) workbook binary as a Uint8Array.
 */
export function buildXlsxWorkbook(rawSheets: XlsxSheet[]): Uint8Array {
  const sheetsToBuild = rawSheets.length > 0 ? rawSheets : [{ name: 'Sheet1', rows: [[]] }]
  const usedNames = new Set<string>()
  const sheets = sheetsToBuild.map((sheet) => ({
    ...sheet,
    name: sanitizeSheetName(sheet.name, usedNames),
  }))

  const contentTypeOverrides = sheets
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('\n  ')

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentTypeOverrides}
</Types>`

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbookSheetsXml = sheets
    .map(
      (sheet, idx) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`,
    )
    .join('\n    ')

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${workbookSheetsXml}
  </sheets>
</workbook>`

  const workbookRelsEntries = sheets
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`,
    )
    .join('\n  ')

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelsEntries}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const entries: ZipEntryInput[] = [
    { path: '[Content_Types].xml', data: UTF8_ENCODER.encode(contentTypesXml) },
    { path: '_rels/.rels', data: UTF8_ENCODER.encode(rootRelsXml) },
    { path: 'xl/workbook.xml', data: UTF8_ENCODER.encode(workbookXml) },
    { path: 'xl/_rels/workbook.xml.rels', data: UTF8_ENCODER.encode(workbookRelsXml) },
    { path: 'xl/styles.xml', data: UTF8_ENCODER.encode(buildStylesXml()) },
  ]

  sheets.forEach((sheet, idx) => {
    entries.push({
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      data: UTF8_ENCODER.encode(buildWorksheetXml(sheet)),
    })
  })

  return buildZipArchive(entries)
}

function escapeCsvCell(value: XlsxPrimitive): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Serializes rows to UTF-8 CSV with BOM so Excel renders Peso signs (₱) properly.
 */
export function buildCsvContent(rows: XlsxCell[][]): string {
  const lines = rows.map((row) =>
    row
      .map((cell) => {
        const normalized = normalizeCell(cell)
        return escapeCsvCell(normalized.value)
      })
      .join(','),
  )
  return `\uFEFF${lines.join('\r\n')}`
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Triggers a browser download of an OpenXML (.xlsx) workbook.
 */
export function downloadXlsxWorkbook(filename: string, sheets: XlsxSheet[]): void {
  const bytes = buildXlsxWorkbook(sheets)
  const safeName = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerBlobDownload(blob, safeName)
}

/**
 * Triggers a browser download of a UTF-8 CSV file.
 */
export function downloadCsvFile(filename: string, rows: XlsxCell[][]): void {
  const csv = buildCsvContent(rows)
  const safeName = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerBlobDownload(blob, safeName)
}
