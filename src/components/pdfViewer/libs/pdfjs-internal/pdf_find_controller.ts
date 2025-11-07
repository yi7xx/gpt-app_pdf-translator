import { getNormalizeWithNFKC } from './pdf_find_utils';

/**
 * 这是 pdfjs 内部实现 的 normalize 方法
 * 参考 https://github.com/mozilla/pdf.js/blob/master/web/pdf_find_controller.js
 */

const CHARACTERS_TO_NORMALIZE: Record<string, string> = {
  '\u2010': '-', // Hyphen
  '\u2018': "'", // Left single quotation mark
  '\u2019': "'", // Right single quotation mark
  '\u201A': "'", // Single low-9 quotation mark
  '\u201B': "'", // Single high-reversed-9 quotation mark
  '\u201C': '"', // Left double quotation mark
  '\u201D': '"', // Right double quotation mark
  '\u201E': '"', // Double low-9 quotation mark
  '\u201F': '"', // Double high-reversed-9 quotation mark
  '\u00BC': '1/4', // Vulgar fraction one quarter
  '\u00BD': '1/2', // Vulgar fraction one half
  '\u00BE': '3/4', // Vulgar fraction three quarters
};

// These diacritics aren't considered as combining diacritics
// when searching in a document:
//   https://searchfox.org/mozilla-central/source/intl/unicharutil/util/is_combining_diacritic.py.
// The combining class definitions can be found:
//   https://www.unicode.org/reports/tr44/#Canonical_Combining_Class_Values
// Category 0 corresponds to [^\p{Mn}].
export const DIACRITICS_EXCEPTION = new Set([
  // UNICODE_COMBINING_CLASS_KANA_VOICING
  // https://www.compart.com/fr/unicode/combining/8
  0x3099, 0x309a,
  // UNICODE_COMBINING_CLASS_VIRAMA (under 0xFFFF)
  // https://www.compart.com/fr/unicode/combining/9
  0x094d, 0x09cd, 0x0a4d, 0x0acd, 0x0b4d, 0x0bcd, 0x0c4d, 0x0ccd, 0x0d3b,
  0x0d3c, 0x0d4d, 0x0dca, 0x0e3a, 0x0eba, 0x0f84, 0x1039, 0x103a, 0x1714,
  0x1734, 0x17d2, 0x1a60, 0x1b44, 0x1baa, 0x1bab, 0x1bf2, 0x1bf3, 0x2d7f,
  0xa806, 0xa82c, 0xa8c4, 0xa953, 0xa9c0, 0xaaf6, 0xabed,
  // 91
  // https://www.compart.com/fr/unicode/combining/91
  0x0c56,
  // 129
  // https://www.compart.com/fr/unicode/combining/129
  0x0f71,
  // 130
  // https://www.compart.com/fr/unicode/combining/130
  0x0f72, 0x0f7a, 0x0f7b, 0x0f7c, 0x0f7d, 0x0f80,
  // 132
  // https://www.compart.com/fr/unicode/combining/132
  0x0f74,
]);

const DIACRITICS_REG_EXP = /\p{M}+/gu;

// The range [AC00-D7AF] corresponds to the Hangul syllables.
// The few other chars are some CJK Compatibility Ideographs.
const SYLLABLES_REG_EXP = /[\uAC00-\uD7AF\uFA6C\uFACF-\uFAD1\uFAD5-\uFAD7]+/g;
const SYLLABLES_LENGTHS = new Map();
// When decomposed (in using NFD) the above syllables will start
// with one of the chars in this regexp.
const FIRST_CHAR_SYLLABLES_REG_EXP =
  '[\\u1100-\\u1112\\ud7a4-\\ud7af\\ud84a\\ud84c\\ud850\\ud854\\ud857\\ud85f]';

const NFKC_CHARS_TO_NORMALIZE = new Map();

let noSyllablesRegExp: RegExp | null = null;
let withSyllablesRegExp: RegExp | null = null;

export const normalize = (text: string, isParagraph: boolean = false) => {
  // The diacritics in the text or in the query can be composed or not.
  // So we use a decomposed text using NFD (and the same for the query)
  // in order to be sure that diacritics are in the same order.

  // Collect syllables length and positions.
  const syllablePositions: [number, number][] = [];
  let m;
  while ((m = SYLLABLES_REG_EXP.exec(text)) !== null) {
    let { index } = m;
    for (const char of m[0]) {
      let len = SYLLABLES_LENGTHS.get(char);
      if (!len) {
        len = char.normalize('NFD').length;
        SYLLABLES_LENGTHS.set(char, len);
      }
      syllablePositions.push([len, index++]);
    }
  }

  let normalizationRegex;
  if (syllablePositions.length === 0 && noSyllablesRegExp) {
    normalizationRegex = noSyllablesRegExp;
  } else if (syllablePositions.length > 0 && withSyllablesRegExp) {
    normalizationRegex = withSyllablesRegExp;
  } else {
    // Compile the regular expression for text normalization once.
    const replace = Object.keys(CHARACTERS_TO_NORMALIZE).join('');
    const toNormalizeWithNFKC = getNormalizeWithNFKC();

    // 3040-309F: Hiragana
    // 30A0-30FF: Katakana
    const CJK = '(?:\\p{Ideographic}|[\u3040-\u30FF])';
    const HKDiacritics = '(?:\u3099|\u309A)';
    const CompoundWord = '\\p{Ll}-\\n\\p{Lu}';
    const regexp = `([${replace}])|([${toNormalizeWithNFKC}])|(${HKDiacritics}\\n)|(\\p{M}+(?:-\\n)?)|(${CompoundWord})|(\\S-\\n)|(${CJK}\\n)|(\\n)`;

    if (syllablePositions.length === 0) {
      // Most of the syllables belong to Hangul so there are no need
      // to search for them in a non-Hangul document.
      // We use the \0 in order to have the same number of groups.
      normalizationRegex = noSyllablesRegExp = new RegExp(
        regexp + '|(\\u0000)',
        'gum'
      );
    } else {
      normalizationRegex = withSyllablesRegExp = new RegExp(
        regexp + `|(${FIRST_CHAR_SYLLABLES_REG_EXP})`,
        'gum'
      );
    }
  }

  // The goal of this function is to normalize the string and
  // be able to get from an index in the new string the
  // corresponding index in the old string.
  // For example if we have: abCd12ef456gh where C is replaced by ccc
  // and numbers replaced by nothing (it's the case for diacritics), then
  // we'll obtain the normalized string: abcccdefgh.
  // So here the reverse map is: [0,1,2,2,2,3,6,7,11,12].

  // The goal is to obtain the array: [[0, 0], [3, -1], [4, -2],
  // [6, 0], [8, 3]].
  // which can be used like this:
  //  - let say that i is the index in new string and j the index
  //    the old string.
  //  - if i is in [0; 3[ then j = i + 0
  //  - if i is in [3; 4[ then j = i - 1
  //  - if i is in [4; 6[ then j = i - 2
  //  ...
  // Thanks to a binary search it's easy to know where is i and what's the
  // shift.
  // Let say that the last entry in the array is [x, s] and we have a
  // substitution at index y (old string) which will replace o chars by n chars.
  // Firstly, if o === n, then no need to add a new entry: the shift is
  // the same.
  // Secondly, if o < n, then we push the n - o elements:
  // [y - (s - 1), s - 1], [y - (s - 2), s - 2], ...
  // Thirdly, if o > n, then we push the element: [y - (s - n), o + s - n]

  // Collect diacritics length and positions.
  const rawDiacriticsPositions: [number, number][] = [];
  while ((m = DIACRITICS_REG_EXP.exec(text)) !== null) {
    rawDiacriticsPositions.push([m[0].length, m.index]);
  }

  let normalized = text.normalize('NFD');
  const positions = [0, 0];
  let rawDiacriticsIndex = 0;
  let syllableIndex = 0;
  let shift = 0;
  let shiftOrigin = 0;
  let eol = 0;
  let hasDiacritics = false;

  // 记录换行符的位置
  const eolPositions: number[] = [];

  normalized = normalized.replace(
    normalizationRegex,
    (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, i) => {
      i -= shiftOrigin;
      if (p1) {
        // Maybe fractions or quotations mark...
        const replacement = CHARACTERS_TO_NORMALIZE[p1]!;
        const jj = replacement.length;
        for (let j = 1; j < jj; j++) {
          positions.push(i - shift + j, shift - j);
        }
        shift -= jj - 1;
        return replacement;
      }

      if (p2) {
        // Use the NFKC representation to normalize the char.
        let replacement = NFKC_CHARS_TO_NORMALIZE.get(p2);
        if (!replacement) {
          replacement = p2.normalize('NFKC');
          NFKC_CHARS_TO_NORMALIZE.set(p2, replacement);
        }
        const jj = replacement.length;
        for (let j = 1; j < jj; j++) {
          positions.push(i - shift + j, shift - j);
        }
        shift -= jj - 1;
        return replacement;
      }

      if (p3) {
        // We've a Katakana-Hiragana diacritic followed by a \n so don't replace
        // the \n by a whitespace.
        hasDiacritics = true;

        // Diacritic.
        if (i + eol === rawDiacriticsPositions[rawDiacriticsIndex]?.[1]) {
          ++rawDiacriticsIndex;
        } else {
          // i is the position of the first diacritic
          // so (i - 1) is the position for the letter before.
          positions.push(i - 1 - shift + 1, shift - 1);
          shift -= 1;
          shiftOrigin += 1;
        }

        // End-of-line.
        positions.push(i - shift + 1, shift);
        if (isParagraph) {
          eolPositions.push(i - shift + 1);
        }
        shiftOrigin += 1;
        eol += 1;
        return p3.charAt(0);
      }

      if (p4) {
        const hasTrailingDashEOL = p4.endsWith('\n');
        const len = hasTrailingDashEOL ? p4.length - 2 : p4.length;

        // Diacritics.
        hasDiacritics = true;
        let jj = len;
        if (i + eol === rawDiacriticsPositions[rawDiacriticsIndex]?.[1]) {
          jj -= rawDiacriticsPositions[rawDiacriticsIndex]![0];
          ++rawDiacriticsIndex;
        }

        for (let j = 1; j <= jj; j++) {
          // i is the position of the first diacritic
          // so (i - 1) is the position for the letter before.
          positions.push(i - 1 - shift + j, shift - j);
        }
        shift -= jj;
        shiftOrigin += jj;

        if (hasTrailingDashEOL) {
          // Diacritics are followed by a -\n.
          // See comments in `if (p6)` block.
          i += len - 1;
          positions.push(i - shift + 1, 1 + shift);
          shift += 1;
          shiftOrigin += 1;
          eol += 1;
          if (isParagraph) eolPositions.push(i - shift + 1);
          return p4.slice(0, len);
        }

        return p4;
      }

      if (p5) {
        // Compound word with a line break after the hyphen.
        // Since the \n isn't in the original text, o = 3 and n = 3.
        shiftOrigin += 1;
        eol += 1;
        return p5.replace('\n', '');
      }

      if (p6) {
        // "X-\n" is removed because an hyphen at the end of a line
        // with not a space before is likely here to mark a break
        // in a word.
        // If X is encoded with UTF-32 then it can have a length greater than 1.
        // The \n isn't in the original text so here y = i, n = X.len - 2 and
        // o = X.len - 1.
        const len = p6.length - 2;
        positions.push(i - shift + len, 1 + shift);
        if (isParagraph) eolPositions.push(i - shift + len);
        shift += 1;
        shiftOrigin += 1;
        eol += 1;
        return p6.slice(0, -2);
      }

      if (p7) {
        // An ideographic at the end of a line doesn't imply adding an extra
        // white space.
        // A CJK can be encoded in UTF-32, hence their length isn't always 1.
        const len = p7.length - 1;
        positions.push(i - shift + len, shift);
        if (isParagraph) eolPositions.push(i - shift + len);
        shiftOrigin += 1;
        eol += 1;
        return p7.slice(0, -1);
      }

      if (p8) {
        eolPositions.push(i - shift + 1);
        // eol is replaced by space: "foo\nbar" is likely equivalent to
        // "foo bar".
        positions.push(i - shift + 1, shift - 1);
        shift -= 1;
        shiftOrigin += 1;
        eol += 1;
        return ' ';
      }

      // p8
      if (i + eol === syllablePositions[syllableIndex]?.[1]) {
        // A syllable (1 char) is replaced with several chars (n) so
        // newCharsLen = n - 1.
        const newCharLen = syllablePositions[syllableIndex]![0] - 1;
        ++syllableIndex;
        for (let j = 1; j <= newCharLen; j++) {
          positions.push(i - (shift - j), shift - j);
        }
        shift -= newCharLen;
        shiftOrigin += newCharLen;
      }
      return p9;
    }
  );

  positions.push(normalized.length, shift);
  const starts = new Uint32Array(positions.length >> 1);
  const shifts = new Int32Array(positions.length >> 1);
  for (let i = 0, ii = positions.length; i < ii; i += 2) {
    starts[i >> 1] = positions[i]!;
    shifts[i >> 1] = positions[i + 1]!;
  }

  const uniqueEolPositions = [...new Set(eolPositions)].sort((a, b) => a - b);

  return [normalized, [starts, shifts], hasDiacritics, uniqueEolPositions] as [
    string,
    [Uint32Array, Int32Array],
    boolean,
    number[],
  ];
};

/**
 * Use binary search to find the index of the first item in a given array which
 * passes a given condition. The items are expected to be sorted in the sense
 * that if the condition is true for one item in the array, then it is also true
 * for all following items.
 *
 *  @return Index of the first array element to pass the test,
 *                   or |items.length| if no such element exists.
 */
export function binarySearchFirstItem(
  items: Uint32Array | Int32Array,
  condition: (item: number) => boolean,
  start = 0
) {
  let minIndex = start;
  let maxIndex = items.length - 1;

  if (maxIndex < 0 || !condition(items[maxIndex]!)) {
    return items.length;
  }
  if (condition(items[minIndex]!)) {
    return minIndex;
  }

  while (minIndex < maxIndex) {
    const currentIndex = (minIndex + maxIndex) >> 1;
    const currentItem = items[currentIndex]!;
    if (condition(currentItem)) {
      maxIndex = currentIndex;
    } else {
      minIndex = currentIndex + 1;
    }
  }
  return minIndex; /* === maxIndex */
}

// Determine the original, non-normalized, match index such that highlighting of
// search results is correct in the `textLayer` for strings containing e.g. "½"
// characters; essentially "inverting" the result of the `normalize` function.
export function getOriginalIndex(
  diffs: [Uint32Array, Int32Array],
  pos: number,
  len: number
): [number, number] {
  if (!diffs) {
    return [pos, len];
  }

  const [starts, shifts] = diffs;
  // First char in the new string.
  const start = pos;
  // Last char in the new string.
  const end = pos + len - 1;
  let i = binarySearchFirstItem(starts, x => x >= start);
  if (starts[i]! > start) {
    --i;
  }

  let j = binarySearchFirstItem(starts, x => x >= end, i);
  if (starts[j]! > end) {
    --j;
  }

  // First char in the old string.
  const oldStart = start + shifts[i]!;

  // Last char in the old string.
  const oldEnd = end + shifts[j]!;
  const oldLen = oldEnd + 1 - oldStart;

  return [oldStart, oldLen];
}
