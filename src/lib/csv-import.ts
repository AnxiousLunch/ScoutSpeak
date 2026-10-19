import Papa from 'papaparse'
import { csvRowSchema, normalizeUrl, type CsvRow } from './validation'

export const CSV_MAX_SIZE_BYTES = 1024 * 1024 // 1 MB
export const CSV_MAX_ROWS = 500

export interface CsvParseResultRow {
  rowIndex: number
  raw: Record<string, string>
  parsed?: CsvRow
  normalizedUrl?: string
  errors: string[]
}

export interface CsvImportReport {
  accepted: { rowIndex: number; company_name: string; website_url: string; normalized_url: string }[]
  rejected: { rowIndex: number; company_name?: string; website_url?: string; reasons: string[] }[]
  deduplicated: { rowIndex: number; company_name: string; website_url: string; keptRowIndex: number }[]
}

export function parseCsvPreview(file: File): Promise<{
  rows: CsvParseResultRow[]
  error?: string
}> {
  return new Promise((resolve) => {
    if (file.size > CSV_MAX_SIZE_BYTES) {
      resolve({
        rows: [],
        error: `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max size is 1 MB.`,
      })
      return
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > CSV_MAX_ROWS) {
          resolve({
            rows: [],
            error: `Too many rows (${results.data.length}). Max is ${CSV_MAX_ROWS}.`,
          })
          return
        }

        const rows: CsvParseResultRow[] = results.data.map((raw, index) => {
          const rowIndex = index + 2 // 1-based header + data row offset
          const companyName = extractColumn(raw, ['company_name', 'name', 'company'])
          const websiteUrl = extractColumn(raw, ['website_url', 'website', 'url'])
          const parsed = csvRowSchema.safeParse({
            company_name: companyName,
            website_url: websiteUrl,
          })

          return {
            rowIndex,
            raw,
            parsed: parsed.success ? parsed.data : undefined,
            normalizedUrl: parsed.success ? normalizeUrl(parsed.data.website_url) : undefined,
            errors: parsed.success ? [] : parsed.error.errors.map((e) => e.message),
          }
        })

        resolve({ rows })
      },
      error: (error) => {
        resolve({ rows: [], error: error.message })
      },
    })
  })
}

function extractColumn(row: Record<string, string>, aliases: string[]): string {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const key = keys.find(
      (k) => k.trim().toLowerCase().replace(/\s+/g, '_') === alias.toLowerCase()
    )
    if (key) {
      return row[key]?.trim() ?? ''
    }
  }
  return ''
}

export function buildImportReport(
  rows: CsvParseResultRow[],
  existingUrls: string[]
): CsvImportReport {
  const accepted: CsvImportReport['accepted'] = []
  const rejected: CsvImportReport['rejected'] = []
  const deduplicated: CsvImportReport['deduplicated'] = []
  const seenUrls = new Set(existingUrls.map((u) => normalizeUrl(u)))

  for (const row of rows) {
    if (!row.parsed || row.errors.length > 0) {
      rejected.push({
        rowIndex: row.rowIndex,
        company_name: row.raw.company_name ?? row.raw.name ?? row.raw.company,
        website_url: row.raw.website_url ?? row.raw.website ?? row.raw.url,
        reasons: row.errors.length > 0 ? row.errors : ['Invalid row'],
      })
      continue
    }

    const normalized = row.normalizedUrl!
    if (seenUrls.has(normalized)) {
      const kept = accepted.find((a) => a.normalized_url === normalized)
      deduplicated.push({
        rowIndex: row.rowIndex,
        company_name: row.parsed.company_name,
        website_url: row.parsed.website_url,
        keptRowIndex: kept?.rowIndex ?? 0,
      })
      continue
    }

    seenUrls.add(normalized)
    accepted.push({
      rowIndex: row.rowIndex,
      company_name: row.parsed.company_name,
      website_url: row.parsed.website_url,
      normalized_url: normalized,
    })
  }

  return { accepted, rejected, deduplicated }
}
