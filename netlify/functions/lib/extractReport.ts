// Core OCR extraction logic, kept separate from the Netlify HTTP handler so
// it can be unit-tested without spinning up a function server.

export interface ExtractedCatch {
  species: 'coho' | 'chinook' | 'pink' | 'chum' | 'sockeye' | 'steelhead' | 'other'
  other_species_label: string
  count: number
}

export interface ExtractedEntry {
  entry_date: string
  guest_name: string
  river: string
  catches: ExtractedCatch[]
}

export interface ExtractedReport {
  group_name: string
  pilot: string
  trip_start_date: string
  trip_end_date: string
  entries: ExtractedEntry[]
}

const TOOL_NAME = 'record_camp_report'

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    group_name: {
      type: 'string',
      description: 'The group/family name from the "Group:" field at the top of the report, e.g. "Katz x2".',
    },
    pilot: {
      type: 'string',
      description: 'The pilot name from the "Pilot:" field. Empty string if not written.',
    },
    trip_start_date: {
      type: 'string',
      description: 'ISO 8601 date (YYYY-MM-DD) for the first day of the "Trip Date:" range.',
    },
    trip_end_date: {
      type: 'string',
      description:
        'ISO 8601 date (YYYY-MM-DD) for the last day of the "Trip Date:" range. Empty string if the trip is a single day.',
    },
    entries: {
      type: 'array',
      description: 'One entry per guest/river row in the report tables, across every dated block.',
      items: {
        type: 'object',
        properties: {
          entry_date: {
            type: 'string',
            description: 'ISO 8601 date (YYYY-MM-DD) for the dated block this row belongs to.',
          },
          guest_name: {
            type: 'string',
            description:
              'The name written in the Guest column for this row. If it is a ditto mark (quote marks, ") meaning ' +
              '"same as above", resolve it to the actual name from the nearest row above in the same column.',
          },
          river: {
            type: 'string',
            description:
              'The river/location written in the River column for this row. If it is a ditto mark meaning "same ' +
              'as above", resolve it to the actual river from the nearest row above in the same column.',
          },
          catches: {
            type: 'array',
            description:
              'Each Species/# pair filled in on this row (a row can have up to three). Skip empty Species/# pairs.',
            items: {
              type: 'object',
              properties: {
                species: {
                  type: 'string',
                  enum: ['coho', 'chinook', 'pink', 'chum', 'sockeye', 'steelhead', 'other'],
                  description:
                    'Map the written species to one of these exactly. Use "other" for anything else (e.g. a ' +
                    'trout species), and put the exact written text in other_species_label.',
                },
                other_species_label: {
                  type: 'string',
                  description: 'Only set when species is "other" — the exact species text as written. Empty string otherwise.',
                },
                count: {
                  type: 'integer',
                  minimum: 0,
                  description: 'The number written in the # column for this species.',
                },
              },
              required: ['species', 'count'],
            },
          },
        },
        required: ['entry_date', 'guest_name', 'river', 'catches'],
      },
    },
  },
  required: ['group_name', 'trip_start_date', 'entries'],
}

function systemPrompt(todayIso: string): string {
  return `You transcribe handwritten fish-camp catch reports into structured data. Each report is a single \
sheet with a header row ("Group:", "Trip Date:", "Pilot:") followed by one or more dated blocks. Each block \
covers one calendar date (handwritten near the block, e.g. "Aug 7") and contains a table with columns: Guest, \
River, Classified/Unclassified, then up to three repeated Species/# column pairs.

Rules:
- IGNORE the "Classified/Unclassified" column and the "Parks — Mark if landed" checkbox section entirely — \
they are out of scope for this extraction.
- A row can report more than one species (multiple Species/# pairs) — capture every non-empty pair for that row.
- Ditto marks (quote marks, ", or similar) in the Guest or River column mean "same value as the row above in \
this column" — resolve them to the actual repeated text, never output a literal ditto mark.
- Skip any Species/# pair that is blank. Do not invent a zero-count catch.
- Dates are written without a year (e.g. "Aug 7-9", "Aug 8"). Today's date is ${todayIso}. Assume the trip's \
year is the same as today's year, unless that would place the trip more than a few days in the future, in \
which case use the previous year instead.
- Output every date as ISO 8601 (YYYY-MM-DD).
- If the pilot or trip end date isn't written, use an empty string rather than guessing.
- Call the ${TOOL_NAME} tool exactly once with the full structured result.`
}

export async function extractReportFromImage(opts: {
  imageBase64: string
  mimeType: string
  todayIso: string
  apiKey: string
  model?: string
}): Promise<ExtractedReport> {
  const model = opts.model ?? 'claude-sonnet-5'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt(opts.todayIso),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: opts.mimeType, data: opts.imageBase64 },
            },
            {
              type: 'text',
              text: 'Transcribe this handwritten fish camp catch report.',
            },
          ],
        },
      ],
      tools: [
        {
          name: TOOL_NAME,
          description: 'Records the structured data transcribed from a handwritten fish camp catch report.',
          input_schema: REPORT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(`Anthropic API error ${response.status}: ${bodyText.slice(0, 500)}`)
  }

  const body = await response.json()
  const toolUse = (body.content ?? []).find((block: { type: string }) => block.type === 'tool_use')
  if (!toolUse) {
    throw new Error('Model did not return a structured result')
  }

  return toolUse.input as ExtractedReport
}
