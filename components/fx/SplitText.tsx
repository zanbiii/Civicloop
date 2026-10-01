import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function graphemes(word: string): string[] {
  return segmenter ? Array.from(segmenter.segment(word), (part) => part.segment) : Array.from(word);
}

interface SplitTextProps {
  text: string;
  className?: string;
  /** Index offset, so several SplitTexts in one heading continue one stagger. */
  startIndex?: number;
  /** Delay before the first character, in ms. */
  delay?: number;
  /** Per-character neon gradient that drifts across the word. */
  gradient?: boolean;
}

/**
 * Heading reveal: every character rises from blur on its own stagger. Splits by grapheme so
 * ಕನ್ನಡ / हिन्दी conjuncts stay intact, and keeps words unbreakable so lines wrap normally.
 * The animation is CSS (`.fx-split`), so it holds while the boot overlay is up.
 */
export default function SplitText({ text, className, startIndex = 0, delay = 0, gradient = false }: SplitTextProps) {
  // Pre-number every grapheme so the stagger index runs continuously across words.
  let count = startIndex;
  const words = text.split(/(\s+)/).map((word) =>
    /^\s+$/.test(word) ? null : graphemes(word).map((char) => ({ char, i: count++ })),
  );
  return (
    <span className={cn('fx-split', gradient && 'fx-split-gradient', className)} style={{ '--base': `${delay}ms` } as CSSProperties}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((chars, wordIndex) =>
          chars === null ? (
            ' '
          ) : (
            <span key={wordIndex} className="fx-split-word">
              {chars.map(({ char, i }) => (
                <span key={i} className="fx-split-char" style={{ '--i': i } as CSSProperties}>
                  {char}
                </span>
              ))}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
