import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';

/**
 * Read a data file and return an array of records.
 *
 * Handles both parquet and JSONL files.
 */
export async function readDataFile(file: string): Promise<Record<string, unknown>[]> {
  const ext = extname(file).toLowerCase();

  // GAIA distributes its dataset as parquet files.
  if (ext === '.parquet') {
    const buffer = await asyncBufferFromFile(file);
    return (await parquetReadObjects({ file: buffer })) as Record<string, unknown>[];
  }

  // JSONL is convenient for custom or filtered subsets of the dataset.
  if (ext === '.jsonl') {
    const content = await readFile(file, 'utf-8');
    return content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  throw new Error(`Unsupported data file extension: ${ext}`);
}
