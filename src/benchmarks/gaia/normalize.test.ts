import { describe, expect, it } from 'vitest';

import { gaiaAnswersMatch, normalizeAnswer } from './normalize.js';

describe('normalizeAnswer', () => {
  it('trims and lowercases', () => {
    expect(normalizeAnswer('  Hello World  ')).toBe('hello world');
  });

  it('strips leading articles', () => {
    expect(normalizeAnswer('The quick fox')).toBe('quick fox');
    expect(normalizeAnswer('a dog')).toBe('dog');
    expect(normalizeAnswer('An apple')).toBe('apple');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeAnswer('yes.')).toBe('yes');
    expect(normalizeAnswer('done!!')).toBe('done');
    expect(normalizeAnswer('what?!')).toBe('what');
    expect(normalizeAnswer('items: a, b, c;')).toBe('items: a, b, c');
  });

  it('collapses whitespace', () => {
    expect(normalizeAnswer('too   many   spaces')).toBe('too many spaces');
    expect(normalizeAnswer('tabs\there')).toBe('tabs here');
  });

  it('handles empty and whitespace-only input', () => {
    expect(normalizeAnswer('')).toBe('');
    expect(normalizeAnswer('   ')).toBe('');
  });
});

describe('gaiaAnswersMatch', () => {
  it('matches exact answers after normalization', () => {
    expect(gaiaAnswersMatch('Paris', 'paris')).toBe(true);
    expect(gaiaAnswersMatch('  The Moon  ', 'moon')).toBe(true);
  });

  it('matches numerically equivalent values', () => {
    expect(gaiaAnswersMatch('1,000', '1000')).toBe(true);
    expect(gaiaAnswersMatch('1 000', '1000')).toBe(true);
    expect(gaiaAnswersMatch('3.14', '3.14')).toBe(true);
  });

  it('rejects numerically different values', () => {
    expect(gaiaAnswersMatch('17000', '17')).toBe(false);
    expect(gaiaAnswersMatch('420', '42')).toBe(false);
    expect(gaiaAnswersMatch('100', '10')).toBe(false);
  });

  it('matches expected answer as a whole word in model output', () => {
    expect(gaiaAnswersMatch('the answer is 17', '17')).toBe(true);
    expect(gaiaAnswersMatch('result: foo bar', 'foo bar')).toBe(true);
  });

  it('rejects partial word matches', () => {
    expect(gaiaAnswersMatch('cat123', 'cat')).toBe(false);
    expect(gaiaAnswersMatch('pretest', 'test')).toBe(false);
  });

  it('rejects completely different answers', () => {
    expect(gaiaAnswersMatch('London', 'Paris')).toBe(false);
    expect(gaiaAnswersMatch('42', 'hello')).toBe(false);
  });
});
