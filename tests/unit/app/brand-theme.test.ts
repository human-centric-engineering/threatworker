/**
 * ThreatWorker's light-theme `text-primary` override must cover every form
 * Sunrise uses.
 *
 * Brand yellow is the `primary` fill, and the design system forbids yellow text
 * on the light theme (about 1.6:1 on white). Sunrise uses `primary` as a text
 * colour in many components, so `app/brand-theme.css` repaints each `text-primary`
 * class form in the ochre link colour on light (owner ruling, t-2). The override
 * is keyed to Tailwind class names, so a form it does not list would silently
 * render yellow text again: a new Sunrise component using, say,
 * `focus:text-primary`. This test reads every component and page for the forms
 * actually in use and fails on any the stylesheet does not select.
 *
 * Fork-owned; declared in `lib/app/ci.ts`'s `appAlwaysRunTests` because it reads
 * the tree rather than importing what it checks.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCANNED = ['components', 'app'];
/** A class token ending in `text-primary`, with any variant prefix and opacity. */
const FORM = /(?<![\w-])((?:[\w[\]&=.-]+:)*text-primary(?:\/\d+)?)(?![\w-])/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

/** The CSS selector for a class name: every special character backslash-escaped. */
function selectorFor(className: string): string {
  return '.' + className.replace(/[:/[\]&=.]/g, (c) => `\\${c}`);
}

/** The stylesheet with its comments removed, so prose about a class is never read as a rule. */
const css = readFileSync(join(ROOT, 'app/brand-theme.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

const forms = new Map<string, string>();
for (const dir of SCANNED) {
  for (const file of sourceFiles(join(ROOT, dir))) {
    for (const match of readFileSync(file, 'utf8').matchAll(FORM)) {
      if (!forms.has(match[1])) forms.set(match[1], file.slice(ROOT.length + 1));
    }
  }
}

describe('light-theme text-primary override (app/brand-theme.css)', () => {
  it('finds the forms in use, so an empty scan cannot pass', () => {
    expect(forms.has('text-primary')).toBe(true);
  });

  it.each([...forms])('covers `%s` (first seen in %s)', (form) => {
    expect(
      css.includes(selectorFor(form)),
      `app/brand-theme.css has no selector for \`${form}\`. Add it to the light-theme ` +
        `override so it renders in --color-link, not brand yellow.`
    ).toBe(true);
  });

  it('applies the override on the light theme only, weighing no more than a utility', () => {
    const rules = css.match(/[^{}]*text-primary[^{}]*\{/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      // Each match ends in the rule's one opening brace (the pattern admits no other).
      for (const selector of rule.slice(0, -1).split(',')) {
        // :where() keeps the guard at zero specificity, so a variant text colour
        // on the same element (`hover:text-foreground`) still outweighs it.
        expect(selector.trim()).toMatch(/^:where\(:root:not\(\.dark\)\) /);
      }
    }
  });

  it('sits in the utilities layer, not unlayered above every variant', () => {
    // The layer block closes on a line of its own; everything outside it must
    // never mention the class, or that rule would beat every layered variant.
    const layer = css.match(/@layer utilities\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(layer).toContain('.text-primary');
    expect(css.split(layer).join('')).not.toContain('text-primary');
  });
});
