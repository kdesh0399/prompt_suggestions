import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CSV_PATH = path.join(process.cwd(), 'id_summaries.csv');

function parseCSVLine(line: string) {
  // Handles quoted CSV and commas in summary
  const match = line.match(/^([^,]+),["]?(.*?)["]?$/);
  if (!match) return null;
  return { id: match[1].replace(/^\^/, ''), summary: match[2] };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  try {
    const file = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = file.split(/\r?\n/).slice(1); // skip header
    const cleanInputId = id.replace(/^\^/, '').toLowerCase();
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = parseCSVLine(line);
      if (parsed && parsed.id.toLowerCase() === cleanInputId) {
        return NextResponse.json({ id: parsed.id, summary: parsed.summary });
      }
    }
    return NextResponse.json({ error: 'ID not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error reading CSV' }, { status: 500 });
  }
} 