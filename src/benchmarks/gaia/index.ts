import path from 'node:path';

import { z } from 'zod';

import { readDataFile } from '../loaders.js';
import type { Benchmark, Question } from '../types.js';
import { gaiaAnswersMatch } from './normalize.js';

// Zod schema handles the varied GAIA dataset format: some fields are optional across
// dataset versions.
const GaiaEntry = z.object({
  task_id: z.string(),
  Question: z.string(),
  Level: z.coerce.number().optional(),
  'Final answer': z.string(),
  file_name: z.string().optional(),
  file_path: z.string().optional(),
  Annotator_Metadata: z.unknown().optional(),
  'Annotator Metadata': z.unknown().optional(),
});

type GaiaEntry = z.infer<typeof GaiaEntry>;

export const gaiaBenchmark: Benchmark = {
  name: 'gaia',

  async load(options) {
    const { file, limit, filter } = options;

    // Resolve the directory containing the parquet file so the runner can locate attached
    // files referenced by relative path.
    const dataDir = path.resolve(path.dirname(file));
    const rows = await readDataFile(file);

    let entries: GaiaEntry[] = [];
    for (const row of rows) {
      const parsed = GaiaEntry.safeParse(row);
      if (parsed.success) {
        entries.push(parsed.data);
      }
    }

    // Level filter and limit support targeted evaluation (e.g., only Level 1 questions,
    // or first N for quick smoke tests).
    if (filter?.level !== undefined) {
      const level = Number(filter.level);
      entries = entries.filter((e) => e.Level === level);
    }

    if (limit !== undefined) {
      entries = entries.slice(0, limit);
    }

    return entries.map(
      (e): Question => ({
        id: e.task_id,
        prompt: e.Question,
        expectedAnswer: e['Final answer'],
        metadata: {
          level: e.Level,
          fileName: e.file_name,
          filePath: e.file_path,
          dataDir,
        },
      }),
    );
  },

  evaluate(modelAnswer, expectedAnswer) {
    return gaiaAnswersMatch(modelAnswer, expectedAnswer);
  },
};
