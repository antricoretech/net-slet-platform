export interface NavigationSection { readonly key: string; readonly sequence: number; readonly questionVersionIds: readonly string[]; }

/** Builds a stable candidate navigation order from the immutable form contract. */
export function flattenNavigation(sections: readonly NavigationSection[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const section of [...sections].sort((left, right) => left.sequence - right.sequence)) {
    for (const questionVersionId of section.questionVersionIds) {
      if (!seen.has(questionVersionId)) { seen.add(questionVersionId); result.push(questionVersionId); }
    }
  }
  return result;
}

export function nextNavigationIndex(index: number, length: number): number { return length === 0 ? -1 : Math.min(Math.max(index + 1, 0), length - 1); }
export function previousNavigationIndex(index: number, length: number): number { return length === 0 ? -1 : Math.max(Math.min(index - 1, length - 1), 0); }
