import { defaultOptions } from '@/interface/constant';
import { LayoutOptions } from '@/interface/definition';
import { Vertex } from '@/interface/graph';

/**
 * Types and Interfaces
 */
export type VertexIdMap = { [key: string | number]: string | number };
export type VertexIdNumberMap = { [key: string | number]: number };
export type IdVertexMap = { [key: string | number]: Vertex };
export type ConflictResult = { [key: string]: boolean };
export type AlignOptions = {
  conflicts: ConflictResult;
  root?: Map<string | number, string | number>;
  align?: Map<string | number, string | number>;
  horizonOrder?: boolean;
  verticalOrder?: boolean;
};
export type AlignResult = {
  root: Map<string | number, string | number>;
  align: Map<string | number, string | number>;
};
export type CompactionOptions = {
  levels: Vertex[][];
  root: Map<string | number, string | number>;
  align: Map<string | number, string | number>;
  horizonOrder: boolean;
  verticalOrder: boolean;
  vertexMap?: IdVertexMap;
};
export type CompactionResult = {
  sink: VertexIdMap;
  shift: VertexIdNumberMap;
  xcoords: VertexIdNumberMap;
};
export type BlockOptions = CompactionOptions & CompactionResult;

/**
 * Utility Functions
 */

/**
 * Get the position of a vertex in the list of vertices.
 * @param vertex The vertex whose position is to be found.
 * @param vertices The list of vertices.
 * @param reversed Whether the order is reversed.
 * @returns The position of the vertex.
 */
function getPos(vertex: Vertex, vertices: Vertex[], reversed = false): number {
  return reversed ? vertices.length - vertex.getOptions('pos') - 1 : vertex.getOptions('pos');
}

/**
 * Get the previous vertex ID.
 * @param vertex The current vertex.
 * @param reversed Whether the order is reversed.
 * @returns The previous vertex ID.
 */
function getPrev(vertex: Vertex, reversed = false): number {
  return reversed ? vertex.getOptions('next') : vertex.getOptions('prev');
}

/**
 * Get the next vertex ID.
 * @param vertex The current vertex.
 * @param reversed Whether the order is reversed.
 * @returns The next vertex ID.
 */
function getNext(vertex: Vertex, reversed = false): number {
  return reversed ? vertex.getOptions('prev') : vertex.getOptions('next');
}

/**
 * Get the position of the median neighbor below the vertex.
 * @param vertex The current vertex.
 * @param min The minimum position.
 * @returns The position of the median neighbor.
 */
// first run - first connected vertex in the next level with a position(index) greater than or equal to 0 (say 0 / say 2)

// second run - first connected vertex in the next level with a position(index) greater than or equal to 0 (say 0 / say 2)
function getDownMedianNeighborPos(vertex: Vertex, min: number): number {
  const downNeighbors = vertex.edges.filter((edge) => edge.up.id === vertex.id).map((edge) => edge.down);
  const validNeighbors = downNeighbors.filter((neighbor) => neighbor.getOptions('pos') >= min);

  if (validNeighbors.length > 0) return validNeighbors[0].getOptions('pos');
  if (downNeighbors.length > 0) return downNeighbors[0].getOptions('pos');
  return -1;
}

/**
 * Get the conflict key between two vertices.
 * @param from The starting vertex.
 * @param to The ending vertex.
 * @param reversed Whether the order is reversed.
 * @returns The conflict key.
 */
function getConflictKey(from: Vertex, to: Vertex, reversed = false): string {
  return reversed ? `${to.id}_|_${from.id}` : `${from.id}_|_${to.id}`;
}

/**
 * Mark conflicts for a vertex.
 * @param left The left vertex.
 * @param minPos The minimum position.
 * @param maxPos The maximum position.
 * @param conflictResult The conflict result object.
 * @returns The updated conflict result object.
 */
function markVertexConflict(
  left: Vertex,
  minPos: number,
  maxPos: number,
  conflictResult: ConflictResult,
): ConflictResult {
  const downVertices = left.edges.filter((edge) => edge.up.id === left.id).map((edge) => edge.down);
  const conflictingVertices = downVertices.filter((vertex) => {
    const pos = vertex.getOptions('pos');
    return pos < minPos || pos > maxPos;
  });

  conflictingVertices.forEach((vertex) => {
    conflictResult[getConflictKey(left, vertex)] = true;
  });

  return conflictResult;
}

/**
 * Preprocess the levels to set options for each vertex.
 * @param levels The levels of vertices.
 * @returns The vertex map.
 */
function preprocess(levels: Vertex[][]): IdVertexMap {
  const vertexMap: IdVertexMap = {};
  levels.forEach((vertices, lvl) => {
    vertices.forEach((v, i) => {
      v.setOptions('level', lvl);
      v.setOptions('pos', i);
      v.setOptions('prev', vertices[i - 1]?.id);
      v.setOptions('next', vertices[i + 1]?.id);
      vertexMap[v.id] = v;
    });
  });
  return vertexMap;
}

/**
 * Marks conflicts between vertices in a hierarchical graph layout.
 *
 * The function iterates through each level of the graph, and for each vertex in the current level,
 * it calculates the median position of its neighbors in the next level. It then checks for conflicts
 * with all previous vertices in the current level and marks them in the conflict result.
 */
export function markConflicts(levels: Vertex[][]): ConflictResult {
  const conflictResult: ConflictResult = {};

  for (const currentLevel of levels) {
    let minPos = 0;

    // Iterate through each vertex in the current level starting from the second vertex
    for (let currentIndex = 1; currentIndex < currentLevel.length; currentIndex++) {
      // Get the median position of the current vertex's neighbors in the next levels
      let medianNeighborPos = getDownMedianNeighborPos(currentLevel[currentIndex], minPos);
      if (medianNeighborPos === -1) continue;

      if (medianNeighborPos < minPos) medianNeighborPos = minPos;

      for (let prevIndex = 0; prevIndex < currentIndex; prevIndex++) {
        const prevVertex = currentLevel[prevIndex];
        markVertexConflict(prevVertex, minPos, medianNeighborPos, conflictResult);
      }

      minPos = Math.max(minPos, medianNeighborPos);
    }
  }

  return conflictResult;
}

/**
 * Get the median upper neighbors of a vertex.
 * @param vertex The current vertex.
 * @param verticalOrder Whether the order is vertical.
 * @param horizonOrder Whether the order is horizontal.
 * @returns The list of median upper neighbors.
 */
function getMedianUpperNeighbors(vertex: Vertex, verticalOrder = true, horizonOrder = true): Vertex[] {
  let upperNeighbors = vertex.edges.filter((edge) => edge.down.id === vertex.id).map((edge) => edge.up);
  if (!verticalOrder) {
    upperNeighbors = vertex.edges.filter((edge) => edge.up.id === vertex.id).map((edge) => edge.down);
  }

  const upperLength = upperNeighbors.length;
  if (upperLength === 0) return [];

  if (upperLength % 2 === 1) {
    return [upperNeighbors[(upperLength - 1) / 2]];
  }

  return horizonOrder
    ? [upperNeighbors[upperLength / 2 - 1], upperNeighbors[upperLength / 2]]
    : [upperNeighbors[upperLength / 2], upperNeighbors[upperLength / 2 - 1]];
}

/**
 * Align vertices based on the given options.
 * @param levels The levels of vertices.
 * @param options The alignment options.
 * @returns The alignment result.
 */
export function alignVertices(levels: Vertex[][], options: AlignOptions): AlignResult {
  const { root = new Map(), align = new Map(), horizonOrder = true, verticalOrder = true, conflicts } = options;
  const reorderedLevels = [...levels];

  if (root.size === 0 && align.size === 0) {
    levels.flat().forEach((vertex) => {
      root.set(vertex.id, vertex.id);
      align.set(vertex.id, vertex.id);
    });
  }

  if (!verticalOrder) reorderedLevels.reverse();
  if (!horizonOrder)
    reorderedLevels.forEach((level, index) => {
      reorderedLevels[index] = [...level].reverse();
    });

  for (let levelIndex = 1; levelIndex < reorderedLevels.length; levelIndex++) {
    let lastAlignedPos = -1;
    for (const vertex of reorderedLevels[levelIndex]) {
      const upperNeighbors = getMedianUpperNeighbors(vertex, verticalOrder, horizonOrder);
      upperNeighbors.forEach((upperNeighbor) => {
        const upperNeighborPos = getPos(upperNeighbor, reorderedLevels[levelIndex - 1], !horizonOrder);
        if (
          align.get(vertex.id) === vertex.id &&
          !conflicts[getConflictKey(upperNeighbor, vertex)] &&
          lastAlignedPos < upperNeighborPos
        ) {
          align.set(upperNeighbor.id, vertex.id);
          root.set(vertex.id, root.get(upperNeighbor.id) as string | number);
          align.set(vertex.id, root.get(vertex.id) as string | number);
          lastAlignedPos = upperNeighborPos;
        }
      });
    }
  }

  return { root, align };
}

/**
 * Compact the vertices based on the given options.
 * @param options The compaction options.
 * @returns The compaction result.
 */
export function compact(options: CompactionOptions): CompactionResult {
  const { root, align, horizonOrder = true, verticalOrder = true, vertexMap = {}, levels } = options;
  const sink: VertexIdMap = {};
  const shift: VertexIdNumberMap = {};
  let xcoords: VertexIdNumberMap = {};
  let selfRoot: (string | number)[] = [];
  const vertices: (string | number)[] = [];
  root.forEach((_value, key) => {
    vertices.push(key);
  });
  vertices.forEach((vid) => {
    sink[vid] = vid;
    shift[vid] = Number.POSITIVE_INFINITY;
    if (vid === root.get(vid)) selfRoot.push(vid);
  });

  const ordered: (string | number)[] = [];
  const sortMap: { [key: string | number]: (string | number)[] } = {};
  selfRoot.forEach((vid) => {
    const prevVid = getPrev(vertexMap[vid], !horizonOrder);
    if (prevVid !== undefined) {
      const prevRootId = root.get(prevVid) as string | number;
      if (!sortMap[prevRootId]) {
        sortMap[prevRootId] = [vid];
      } else {
        sortMap[prevRootId].push(vid);
      }
    }
    const nextVid = getNext(vertexMap[vid], !horizonOrder);
    if (nextVid !== undefined) {
      const nextRootId = root.get(nextVid) as string | number;
      if (!sortMap[vid]) {
        sortMap[vid] = [nextRootId];
      } else {
        sortMap[vid].push(nextRootId);
      }
    }
  });

  while (selfRoot.length) {
    const tails: { [key: string | number]: boolean } = {};
    selfRoot.forEach((vid) => {
      sortMap[vid]?.forEach((tid) => {
        tails[tid] = true;
      });
    });
    const heads = selfRoot.filter((vid) => !tails[vid]);
    heads.forEach((vid) => {
      ordered.push(vid);
      delete sortMap[vid];
    });
    selfRoot = selfRoot.filter((vid) => !heads.includes(vid));
  }

  ordered.forEach((vid) => {
    xcoords = placeBlock(vid, { root, align, sink, shift, xcoords, verticalOrder, horizonOrder, vertexMap, levels });
  });

  vertices.forEach((vid) => {
    const rootVid = root.get(vid) as string | number;
    xcoords[vid] = xcoords[rootVid];
    if (shift[sink[rootVid]] < Number.POSITIVE_INFINITY) {
      xcoords[vid] += shift[sink[rootVid]];
    }
  });

  return { sink, shift, xcoords };
}

/**
 * Place a block of vertices.
 * @param vid The vertex ID.
 * @param options The block options.
 * @returns The updated x-coordinates.
 */
function placeBlock(vid: string | number, options: BlockOptions): VertexIdNumberMap {
  const { sink, shift, root, align, xcoords, vertexMap = {}, levels, horizonOrder } = options;
  const delta = 1;
  if (xcoords[vid] !== undefined) return xcoords;
  xcoords[vid] = 0;
  let w = vid;
  do {
    const vertex = vertexMap[w];
    if (getPos(vertex, levels[vertex.getOptions('level')], !horizonOrder) === 0) {
      w = align.get(w) as string | number;
      continue;
    }
    const u = root.get(getPrev(vertex, !horizonOrder)) as string | number;
    if (sink[vid] === vid) sink[vid] = sink[u];
    if (sink[vid] !== sink[u]) {
      shift[sink[u]] = Math.min(shift[sink[u]], xcoords[vid] - xcoords[u] - delta);
    } else {
      xcoords[vid] = Math.max(xcoords[vid], xcoords[u] + delta);
    }
    w = align.get(w) as string | number;
  } while (w !== vid);
  return xcoords;
}

/**
 * Balance the levels based on the x-coordinates.
 * @param levels The levels of vertices.
 * @param xss The list of x-coordinates.
 * @param options The layout options.
 * @returns The balanced levels.
 */
function balance(levels: Vertex[][], xss: VertexIdNumberMap[], options: LayoutOptions): Vertex[][] {
  const { width, height, gutter = 0, margin = { left: 0, top: 0 } } = options;
  const { left = 0, top = 0 } = margin;
  levels.flat().forEach((v) => {
    const posList: number[] = xss.map((map) => map[v.id]);
    const xs: number = posList.reduce((prev, cur) => prev + cur, 0) / posList.length;
    v.setOptions('x', left + xs * (width + gutter));
    v.setOptions('y', top + v.getOptions('level') * (height + gutter));
  });
  return levels;
}

/**
 * Normalize the x-coordinates.
 * @param xcoords The x-coordinates.
 * @param reversed Whether the order is reversed.
 * @returns The normalized x-coordinates and width.
 */
function normalize(xcoords: VertexIdNumberMap, reversed = false): { xcoords: VertexIdNumberMap; width: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  Object.keys(xcoords).forEach((key) => {
    if (xcoords[key] < min) min = xcoords[key];
    if (xcoords[key] > max) max = xcoords[key];
  });
  const width = max - min;
  Object.keys(xcoords).forEach((key) => {
    if (min < 0) xcoords[key] += Math.abs(min);
    if (reversed) xcoords[key] = width - xcoords[key];
  });
  return { xcoords, width };
}

/**
 * Main function to layout the vertices using the Brandes-Kopf algorithm.
 * @param levels The levels of vertices.
 * @param layoutOptions The layout options.
 * @returns The balanced levels.
 */
export function brandeskopf(levels: Vertex[][], layoutOptions: LayoutOptions = defaultOptions) {
  const vertexMap = preprocess(levels);
  const conflicts = markConflicts(levels);
  const xss: { xcoords: VertexIdNumberMap; width: number }[] = [];
  [true, false].forEach((verticalOrder) => {
    [true, false].forEach((horizonOrder) => {
      const { root, align } = alignVertices(levels, { conflicts, verticalOrder, horizonOrder });
      const { xcoords } = compact({ root, align, horizonOrder, verticalOrder, vertexMap, levels });
      xss.push(normalize(xcoords, !horizonOrder));
    });
  });
  const minWidthXss = xss.map((xs) => xs.xcoords);
  return balance(levels, minWidthXss, layoutOptions);
}
