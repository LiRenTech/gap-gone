export interface Region {
  start: number;
  end: number;
}

/**
 * Merges a list of regions with a new region.
 * Overlapping adjacent regions are combined.
 */
export function mergeRegions(regions: Region[], newRegion: Region): Region[] {
  // 1. Add new region and sort by start time
  const sorted = [...regions, newRegion].sort((a, b) => a.start - b.start);

  if (sorted.length === 0) return [];

  // 2. Merge overlapping intervals
  const merged: Region[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlap or adjacency: extend the last region
      last.end = Math.max(last.end, current.end);
    } else {
      // No overlap: add as new region
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Removes a region from a list of regions.
 * Can split existing regions or shorten them.
 */
export function subtractRegion(regions: Region[], subtract: Region): Region[] {
  const result: Region[] = [];

  for (const r of regions) {
    // Case 1: No overlap (Subtract region is fully before or after)
    if (subtract.end <= r.start || subtract.start >= r.end) {
      result.push(r);
      continue;
    }

    // Case 2: Overlap
    
    // Left part remains?
    if (r.start < subtract.start) {
      result.push({ start: r.start, end: subtract.start });
    }

    // Right part remains?
    if (r.end > subtract.end) {
      result.push({ start: subtract.end, end: r.end });
    }
  }

  return result;
}
