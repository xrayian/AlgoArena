/**
 * Code Traces Registry & Deterministic Line Mapping Engine.
 *
 * Provides source code listings and step-to-line highlighting mappings
 * for every pathfinding algorithm in Algorithm Arena.
 *
 * **Pure TypeScript**: No React/Three/Zustand imports to preserve framework
 * independence and strict testability.
 *
 * @module algorithms/codeTraces
 */

import type { Point, StepEvent } from './types';

export interface CodeTraceStepContext {
  position?: Point;
  currentPath?: Point[];
}

export interface TraceLineResult {
  lineNumber: number;
  explanation: string;
}

export interface AlgorithmCodeTrace {
  algorithmKey: string;
  name: string;
  code: string[];
  mapStep: (event: StepEvent, context?: CodeTraceStepContext) => TraceLineResult;
  mapRunner: (context: CodeTraceStepContext, nextPoint: Point) => TraceLineResult;
}

// ── Algorithm 1: A* Search ──────────────────────────────────────────────────

const ASTAR_CODE = [
  'function* aStarSearch(grid: GridSnapshot) {',
  '  const openSet = new MinHeap(); // priority by f = g + h',
  '  openSet.push(grid.start, f = h(grid.start));',
  '  gScore.set(grid.start, 0);',
  '',
  '  while (openSet.size > 0) {',
  '    const current = openSet.pop();',
  '    if (isGoal(current)) return reconstructPath(cameFrom, current);',
  '    closedSet.add(current);',
  '',
  '    for (const nbr of getWalkableNeighbors(current)) {',
  '      if (closedSet.has(nbr)) continue;',
  '      const tentativeG = gScore[current] + cost(nbr);',
  '      if (tentativeG < gScore[nbr]) {',
  '        cameFrom[nbr] = current;',
  '        gScore[nbr] = tentativeG;',
  '        openSet.push(nbr, f = tentativeG + h(nbr));',
  '      }',
  '    }',
  '  }',
  '  return null; // goal unreachable',
  '}',
];

const aStarTrace: AlgorithmCodeTrace = {
  algorithmKey: 'astar',
  name: 'A* Search',
  code: ASTAR_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 7,
          explanation: `Popped node (${event.node.x}, ${event.node.y}) with lowest f = g + h score`,
        };
      case 'visit':
        return {
          lineNumber: 9,
          explanation: `Added (${event.node.x}, ${event.node.y}) to closed set (explored)`,
        };
      case 'frontier':
        return {
          lineNumber: 17,
          explanation: `Pushed ${event.nodes.length} evaluated neighbor(s) into OpenSet`,
        };
      case 'path':
        return {
          lineNumber: 15,
          explanation: `Updated came-from predecessor map (path length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 8,
            explanation: `Goal reached! Reconstructed optimal path (${event.result.path?.length ?? 0} steps, cost: ${event.result.cost ?? event.result.path?.length ?? 0})`,
          };
        }
        return {
          lineNumber: 21,
          explanation: 'OpenSet exhausted: goal is unreachable',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 8,
    explanation: `Sprinting along optimal path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 2: Breadth-First Search (BFS) ─────────────────────────────────

const BFS_CODE = [
  'function* breadthFirstSearch(grid: GridSnapshot) {',
  '  const queue = [grid.start]; // FIFO queue',
  '  visited.add(grid.start);',
  '',
  '  while (queue.length > 0) {',
  '    const current = queue.shift();',
  '    if (isGoal(current)) return reconstructPath(cameFrom, current);',
  '',
  '    for (const nbr of getWalkableNeighbors(current)) {',
  '      if (!visited.has(nbr)) {',
  '        visited.add(nbr);',
  '        cameFrom[nbr] = current;',
  '        queue.push(nbr);',
  '      }',
  '    }',
  '  }',
  '  return null; // queue exhausted',
  '}',
];

const bfsTrace: AlgorithmCodeTrace = {
  algorithmKey: 'bfs',
  name: 'Breadth-First Search',
  code: BFS_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 6,
          explanation: `De-queued shallowest node (${event.node.x}, ${event.node.y}) from FIFO queue`,
        };
      case 'visit':
        return {
          lineNumber: 11,
          explanation: `Marked (${event.node.x}, ${event.node.y}) as visited`,
        };
      case 'frontier':
        return {
          lineNumber: 13,
          explanation: `Enqueued ${event.nodes.length} unvisited neighbor(s)`,
        };
      case 'path':
        return {
          lineNumber: 12,
          explanation: `Recorded came-from parent pointer (path length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 7,
            explanation: `Goal reached! Shortest unweighted path found (${event.result.path?.length ?? 0} steps)`,
          };
        }
        return {
          lineNumber: 17,
          explanation: 'Queue exhausted without discovering goal',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 7,
    explanation: `Sprinting along shortest path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 3: Dijkstra's Algorithm ───────────────────────────────────────

const DIJKSTRA_CODE = [
  'function* dijkstraSearch(grid: GridSnapshot) {',
  '  const openSet = new MinHeap(); // priority by dist (cost)',
  '  dist.set(grid.start, 0);',
  '  openSet.push(grid.start, dist = 0);',
  '',
  '  while (openSet.size > 0) {',
  '    const current = openSet.pop();',
  '    if (isGoal(current)) return reconstructPath(cameFrom, current);',
  '    closedSet.add(current);',
  '',
  '    for (const nbr of getWalkableNeighbors(current)) {',
  '      if (closedSet.has(nbr)) continue;',
  '      const tentativeDist = dist[current] + cost(nbr);',
  '      if (tentativeDist < dist[nbr]) {',
  '        cameFrom[nbr] = current;',
  '        dist[nbr] = tentativeDist;',
  '        openSet.push(nbr, dist = tentativeDist);',
  '      }',
  '    }',
  '  }',
  '  return null; // open set exhausted',
  '}',
];

const dijkstraTrace: AlgorithmCodeTrace = {
  algorithmKey: 'dijkstra',
  name: "Dijkstra's Algorithm",
  code: DIJKSTRA_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 7,
          explanation: `Popped node (${event.node.x}, ${event.node.y}) with lowest cumulative travel cost`,
        };
      case 'visit':
        return {
          lineNumber: 9,
          explanation: `Closed node (${event.node.x}, ${event.node.y}): distance is optimal`,
        };
      case 'frontier':
        return {
          lineNumber: 17,
          explanation: `Relaxed ${event.nodes.length} neighboring edge(s)`,
        };
      case 'path':
        return {
          lineNumber: 15,
          explanation: `Updated shortest-path predecessor tree (length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 8,
            explanation: `Goal reached! Optimal cost path confirmed (${event.result.cost ?? event.result.path?.length ?? 0} cost)`,
          };
        }
        return {
          lineNumber: 21,
          explanation: 'OpenSet exhausted: no reachable path to goal',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 8,
    explanation: `Sprinting along optimal path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 4: Depth-First Search (DFS) ───────────────────────────────────

const DFS_CODE = [
  'function* depthFirstSearch(grid: GridSnapshot) {',
  '  const stack = [grid.start]; // LIFO stack',
  '  visited.add(grid.start);',
  '',
  '  while (stack.length > 0) {',
  '    const current = stack.pop();',
  '    if (isGoal(current)) return reconstructPath(cameFrom, current);',
  '',
  '    for (const nbr of getWalkableNeighbors(current)) {',
  '      if (!visited.has(nbr)) {',
  '        visited.add(nbr);',
  '        cameFrom[nbr] = current;',
  '        stack.push(nbr);',
  '      }',
  '    }',
  '  }',
  '  return null; // stack exhausted',
  '}',
];

const dfsTrace: AlgorithmCodeTrace = {
  algorithmKey: 'dfs',
  name: 'Depth-First Search',
  code: DFS_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 6,
          explanation: `Popped deepest node (${event.node.x}, ${event.node.y}) from LIFO stack`,
        };
      case 'visit':
        return {
          lineNumber: 11,
          explanation: `Marked (${event.node.x}, ${event.node.y}) as visited on deep branch`,
        };
      case 'frontier':
        return {
          lineNumber: 13,
          explanation: `Pushed ${event.nodes.length} branch candidate(s) onto stack`,
        };
      case 'path':
        return {
          lineNumber: 12,
          explanation: `Deep branch path updated (current length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 7,
            explanation: `Goal discovered via deep branch exploration (${event.result.path?.length ?? 0} steps)`,
          };
        }
        return {
          lineNumber: 17,
          explanation: 'Stack exhausted without finding goal',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 7,
    explanation: `Sprinting along discovered path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 5: Greedy Best-First ──────────────────────────────────────────

const GREEDY_CODE = [
  'function* greedyBestFirstSearch(grid: GridSnapshot) {',
  '  const frontier = new MinHeap(); // priority by h(node)',
  '  frontier.push(grid.start, h = h(grid.start));',
  '',
  '  while (frontier.size > 0) {',
  '    const current = frontier.pop();',
  '    if (isGoal(current)) return reconstructPath(cameFrom, current);',
  '    closedSet.add(current);',
  '',
  '    for (const nbr of getWalkableNeighbors(current)) {',
  '      if (closedSet.has(nbr)) continue;',
  '      cameFrom[nbr] = current;',
  '      frontier.push(nbr, h = h(nbr));',
  '    }',
  '  }',
  '  return null; // frontier exhausted',
  '}',
];

const greedyTrace: AlgorithmCodeTrace = {
  algorithmKey: 'greedy',
  name: 'Greedy Best-First',
  code: GREEDY_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 6,
          explanation: `Popped node (${event.node.x}, ${event.node.y}) with lowest heuristic distance to goal`,
        };
      case 'visit':
        return {
          lineNumber: 8,
          explanation: `Closed node (${event.node.x}, ${event.node.y})`,
        };
      case 'frontier':
        return {
          lineNumber: 13,
          explanation: `Added ${event.nodes.length} neighbor(s) ordered strictly by h(n)`,
        };
      case 'path':
        return {
          lineNumber: 12,
          explanation: `Updated greedy trail (current steps: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 7,
            explanation: `Goal reached! Path length: ${event.result.path?.length ?? 0} steps`,
          };
        }
        return {
          lineNumber: 16,
          explanation: 'Frontier exhausted: goal unreachable',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 7,
    explanation: `Sprinting along greedy path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 6: Hill Climbing ──────────────────────────────────────────────

const HILLCLIMB_CODE = [
  'function* hillClimbingSearch(grid: GridSnapshot) {',
  '  let current = grid.start;',
  '  path.push(current);',
  '',
  '  while (true) {',
  '    if (isGoal(current)) return path;',
  '    const candidates = getUnvisitedNeighbors(current);',
  '    if (candidates.length === 0) return "trapped"; // dead end',
  '    const best = candidates.reduce((a, b) => h(a) < h(b) ? a : b);',
  '    if (h(best) >= h(current)) return "trapped"; // local minimum',
  '    current = best;',
  '    path.push(current);',
  '  }',
  '}',
];

const hillClimbTrace: AlgorithmCodeTrace = {
  algorithmKey: 'hillclimb',
  name: 'Hill Climbing',
  code: HILLCLIMB_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 6,
          explanation: `Evaluating current node (${event.node.x}, ${event.node.y}) against goal`,
        };
      case 'visit':
        return {
          lineNumber: 11,
          explanation: `Stepped greedily to neighbor (${event.node.x}, ${event.node.y}) with lower h(n)`,
        };
      case 'path':
        return {
          lineNumber: 12,
          explanation: `Extended hill climb path to ${event.path.length} step(s)`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 6,
            explanation: `Goal reached via gradient descent (${event.result.path?.length ?? 0} steps)`,
          };
        }
        if (event.result.status === 'trapped') {
          return {
            lineNumber: 10,
            explanation: 'Trapped in local optimum: no neighbor has strictly lower h(n)',
          };
        }
        return {
          lineNumber: 8,
          explanation: 'Trapped in dead end: zero unvisited neighbors',
        };
      case 'frontier':
        return {
          lineNumber: 7,
          explanation: `Inspecting ${event.nodes.length} neighboring candidate(s)`,
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 6,
    explanation: `Sprinting along hill climbing path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 7: Simulated Annealing ────────────────────────────────────────

const ANNEALING_CODE = [
  'function* simulatedAnnealing(grid: GridSnapshot, T_init: number) {',
  '  let current = grid.start, temp = T_init;',
  '',
  '  while (temp > FREEZE_THRESHOLD) {',
  '    if (isGoal(current)) return path;',
  '    const nbr = pickRandomWalkableNeighbor(current);',
  '    const deltaE = h(nbr) - h(current);',
  '    if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temp)) {',
  '      current = nbr;',
  '      path.push(current);',
  '    }',
  '    temp *= coolingRate;',
  '  }',
  '  return "failed"; // frozen without reaching goal',
  '}',
];

const annealingTrace: AlgorithmCodeTrace = {
  algorithmKey: 'annealing',
  name: 'Simulated Annealing',
  code: ANNEALING_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider': {
        const tempStr = event.temperature !== undefined ? `T=${event.temperature.toFixed(1)}°` : '';
        return {
          lineNumber: 5,
          explanation: `At (${event.node.x}, ${event.node.y}) ${tempStr}: evaluating neighbor move`,
        };
      }
      case 'visit': {
        return {
          lineNumber: 9,
          explanation: `Accepted stochastic move to (${event.node.x}, ${event.node.y})`,
        };
      }
      case 'path':
        return {
          lineNumber: 10,
          explanation: `Thermal trajectory updated (${event.path.length} steps)`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 5,
            explanation: `Goal discovered via thermal exploration (${event.result.path?.length ?? 0} steps)`,
          };
        }
        return {
          lineNumber: 14,
          explanation: 'Temperature frozen below threshold before reaching goal',
        };
      case 'frontier':
        return {
          lineNumber: 6,
          explanation: `Evaluating ${event.nodes.length} neighbor candidate(s)`,
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 5,
    explanation: `Sprinting along annealed path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 8: Bidirectional BFS ──────────────────────────────────────────

const BIDIR_BFS_CODE = [
  'function* bidirectionalBFS(grid: GridSnapshot) {',
  '  const queueFromStart = [grid.start], queueFromGoal = [grid.goal];',
  '',
  '  while (queueFromStart.length > 0 && queueFromGoal.length > 0) {',
  '    // Forward search step from start',
  '    const fNode = queueFromStart.shift();',
  '    if (visitedFromGoal.has(fNode)) return joinPaths(fNode);',
  '    expandNeighbors(fNode, queueFromStart, visitedFromStart);',
  '',
  '    // Backward search step from goal',
  '    const bNode = queueFromGoal.shift();',
  '    if (visitedFromStart.has(bNode)) return joinPaths(bNode);',
  '    expandNeighbors(bNode, queueFromGoal, visitedFromGoal);',
  '  }',
  '  return null; // search frontiers never met',
  '}',
];

const bidirBfsTrace: AlgorithmCodeTrace = {
  algorithmKey: 'bidir-bfs',
  name: 'Bidirectional BFS',
  code: BIDIR_BFS_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider': {
        const isBwd = event.direction === 'backward';
        return {
          lineNumber: isBwd ? 11 : 6,
          explanation: `${isBwd ? 'Backward' : 'Forward'} search popped (${event.node.x}, ${event.node.y})`,
        };
      }
      case 'visit':
        return {
          lineNumber: 8,
          explanation: `Visited node (${event.node.x}, ${event.node.y}) in bidirectional sweep`,
        };
      case 'frontier':
        return {
          lineNumber: 8,
          explanation: `Expanded ${event.nodes.length} nodes into bidirectional frontier`,
        };
      case 'path':
        return {
          lineNumber: 7,
          explanation: `Meeting point detected! Connecting forward & backward paths (${event.path.length} steps)`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 7,
            explanation: `Frontiers met! Optimal path joined (${event.result.path?.length ?? 0} steps)`,
          };
        }
        return {
          lineNumber: 15,
          explanation: 'Frontiers exhausted without meeting',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 7,
    explanation: `Sprinting along joined bidirectional path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 9: Bidirectional A* ───────────────────────────────────────────

const BIDIR_ASTAR_CODE = [
  'function* bidirectionalAStar(grid: GridSnapshot) {',
  '  const fOpen = new MinHeap(), bOpen = new MinHeap();',
  '',
  '  while (fOpen.size > 0 && bOpen.size > 0) {',
  '    if (fOpen.peekF() + bOpen.peekF() >= bestCost) break;',
  '',
  '    // Forward search step towards goal',
  '    const fCurr = fOpen.pop();',
  '    expandFrontier(fCurr, fOpen, fGScore, goal);',
  '',
  '    // Backward search step towards start',
  '    const bCurr = bOpen.pop();',
  '    expandFrontier(bCurr, bOpen, bGScore, start);',
  '  }',
  '  return reconstructMeetingPath();',
  '}',
];

const bidirAstarTrace: AlgorithmCodeTrace = {
  algorithmKey: 'bidir-astar',
  name: 'Bidirectional A*',
  code: BIDIR_ASTAR_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider': {
        const isBwd = event.direction === 'backward';
        return {
          lineNumber: isBwd ? 12 : 8,
          explanation: `${isBwd ? 'Backward' : 'Forward'} search popped (${event.node.x}, ${event.node.y}) with minimal f-cost`,
        };
      }
      case 'visit':
        return {
          lineNumber: 9,
          explanation: `Visited node (${event.node.x}, ${event.node.y}) across heuristic cut boundary`,
        };
      case 'frontier':
        return {
          lineNumber: 9,
          explanation: `Pushed ${event.nodes.length} candidate(s) into directional priority queues`,
        };
      case 'path':
        return {
          lineNumber: 15,
          explanation: `Updated best meeting path (current length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 15,
            explanation: `Stopping condition met! Optimal path reconstructed (${event.result.path?.length ?? 0} steps)`,
          };
        }
        return {
          lineNumber: 5,
          explanation: 'Frontiers exhausted without satisfying meeting threshold',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 15,
    explanation: `Sprinting along bidirectional optimal path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 10: Bellman-Ford ──────────────────────────────────────────────

const BELLMAN_FORD_CODE = [
  'function* bellmanFordSearch(grid: GridSnapshot) {',
  '  dist.set(grid.start, 0);',
  '',
  '  for (let pass = 1; pass <= V - 1; pass++) {',
  '    let improved = false;',
  '    for (const [u, v] of everyEdge(grid)) {',
  '      const tentative = dist[u] + cost(v);',
  '      if (tentative < dist[v]) {',
  '        dist[v] = tentative;',
  '        cameFrom[v] = u;',
  '        improved = true;',
  '      }',
  '    }',
  '    if (!improved) break; // converged early',
  '  }',
  '  return bestReachableGoal(cameFrom, dist);',
  '}',
];

const bellmanFordTrace: AlgorithmCodeTrace = {
  algorithmKey: 'bellman-ford',
  name: 'Bellman-Ford',
  code: BELLMAN_FORD_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 10,
          explanation: `Relaxed edge into (${event.node.x}, ${event.node.y}): distance improved`,
        };
      case 'visit':
        return {
          lineNumber: 11,
          explanation: `Recorded predecessor for (${event.node.x}, ${event.node.y})`,
        };
      case 'frontier':
        return {
          lineNumber: 8,
          explanation: `Completed relaxation sweep over ${event.nodes.length} improved node(s)`,
        };
      case 'path':
        return {
          lineNumber: 11,
          explanation: `Updated shortest-path predecessor tree (length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 17,
            explanation: `Converged! Cheapest reachable goal confirmed (cost: ${event.result.cost ?? event.result.path?.length ?? 0})`,
          };
        }
        return {
          lineNumber: 17,
          explanation: 'Relaxation sweeps exhausted: no reachable path to goal',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 17,
    explanation: `Sprinting along relaxed optimal path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 11: Floyd-Warshall ────────────────────────────────────────────

const FLOYD_WARSHALL_CODE = [
  'function* floydWarshallSearch(grid: GridSnapshot) {',
  '  dist[i][i] = 0; dist[i][j] = cost(i -> j);',
  '',
  '  for (let k = 0; k < V; k++) {',
  '    for (let i = 0; i < V; i++) {',
  '      for (let j = 0; j < V; j++) {',
  '        const via = dist[i][k] + dist[k][j];',
  '        if (via < dist[i][j]) {',
  '          dist[i][j] = via;',
  '          next[i][j] = next[i][k];',
  '        }',
  '      }',
  '    }',
  '  }',
  '  return cheapestGoalPath(dist, next);',
  '}',
];

const floydWarshallTrace: AlgorithmCodeTrace = {
  algorithmKey: 'floyd-warshall',
  name: 'Floyd-Warshall',
  code: FLOYD_WARSHALL_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 8,
          explanation: `Relaying routes through intermediate node (${event.node.x}, ${event.node.y})`,
        };
      case 'visit':
        return {
          lineNumber: 10,
          explanation: `Closed relay (${event.node.x}, ${event.node.y}) into the all-pairs matrix`,
        };
      case 'frontier':
        return {
          lineNumber: 7,
          explanation: `Improved ${event.nodes.length} start-relative pair(s) this pass`,
        };
      case 'path':
        return {
          lineNumber: 10,
          explanation: `Updated next-hop chain (length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 16,
            explanation: `Matrix converged! Cheapest goal path confirmed (cost: ${event.result.cost ?? event.result.path?.length ?? 0})`,
          };
        }
        return {
          lineNumber: 16,
          explanation: 'Matrix converged with goal unreachable',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 16,
    explanation: `Sprinting along all-pairs optimal path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Algorithm 12: Beam Search ───────────────────────────────────────────────

const BEAM_CODE = [
  'function* beamSearch(grid: GridSnapshot, beamWidth = 3) {',
  '  let beam = [grid.start];',
  '',
  '  while (beam.length > 0) {',
  '    const candidates = [];',
  '    for (const current of beam) {',
  '      if (isGoal(current)) return reconstructPath(cameFrom, current);',
  '      closedSet.add(current);',
  '      for (const nbr of getWalkableNeighbors(current)) {',
  '        if (!closedSet.has(nbr)) candidates.push(nbr);',
  '      }',
  '    }',
  '    candidates.sort(by f = g + h);',
  '    beam = candidates.slice(0, beamWidth); // truncate to top-W',
  '  }',
  '  return null; // goal fell outside the beam',
  '}',
];

const beamTrace: AlgorithmCodeTrace = {
  algorithmKey: 'beam',
  name: 'Beam Search',
  code: BEAM_CODE,
  mapStep: (event) => {
    switch (event.kind) {
      case 'consider':
        return {
          lineNumber: 7,
          explanation: `Expanding beam candidate (${event.node.x}, ${event.node.y}) toward heuristic target`,
        };
      case 'visit':
        return {
          lineNumber: 8,
          explanation: `Added (${event.node.x}, ${event.node.y}) to closed set`,
        };
      case 'frontier':
        return {
          lineNumber: 10,
          explanation: `Generated ${event.nodes.length} candidate(s); frontier pruned to top-W`,
        };
      case 'path':
        return {
          lineNumber: 12,
          explanation: `Updated beam trail (current length: ${event.path.length})`,
        };
      case 'done':
        if (event.result.status === 'success') {
          return {
            lineNumber: 7,
            explanation: `Goal reached! Path reconstructed (${event.result.path?.length ?? 0} steps, cost: ${event.result.cost ?? event.result.path?.length ?? 0})`,
          };
        }
        return {
          lineNumber: 16,
          explanation: 'Beam exhausted: goal fell outside the beam width',
        };
    }
  },
  mapRunner: (_context, nextPoint) => ({
    lineNumber: 7,
    explanation: `Sprinting along beam search path to cell (${nextPoint.x}, ${nextPoint.y})`,
  }),
};

// ── Registry Map ────────────────────────────────────────────────────────────

export const CODE_TRACES: Record<string, AlgorithmCodeTrace> = {
  astar: aStarTrace,
  bfs: bfsTrace,
  dijkstra: dijkstraTrace,
  dfs: dfsTrace,
  greedy: greedyTrace,
  hillclimb: hillClimbTrace,
  annealing: annealingTrace,
  'bidir-bfs': bidirBfsTrace,
  'bidir-astar': bidirAstarTrace,
  'bellman-ford': bellmanFordTrace,
  'floyd-warshall': floydWarshallTrace,
  beam: beamTrace,
};

/**
 * Helper to get code trace data for an algorithm key.
 */
export function getCodeTrace(algorithmKey: string): AlgorithmCodeTrace | undefined {
  return CODE_TRACES[algorithmKey];
}
