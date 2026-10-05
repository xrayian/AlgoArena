/**
 * RacerDock — Right Leaderboard Rail & Racer Manager.
 *
 * Implements Section 5.4 & Section 2.2 of the UI/UX Guidelines:
 * - Positioned on right screen rail (fixed right-3 top-16 bottom-20 w-72).
 * - Brick White (#F4F4F4) card with 3px black border and hard offset drop shadow.
 * - Top header with 4 raised LEGO studs.
 * - Live standings sorted by goal proximity/cost.
 * - Stud medals: #1 Gold (#F2CD37), #2 Silver (#A3A2A4), #3 Bronze (#AA7F2E).
 * - Per-racer mini progress bar (6px height) in racer torso color.
 * - Overlay toggle eye, terrain cost toggle, and bottom Reset & Start action buttons.
 *
 * @module ui/RacerDock
 */

import { useState, useMemo } from 'react';
import { useAgentStore, type Agent } from '../state/agentStore';
import { useGridStore } from '../state/gridStore';
import { useRaceStore } from '../state/raceStore';
import { ALGORITHMS, getImplementedAlgorithms } from '../algorithms';
import { playClick, playSnap, playStartFanfare } from '../utils/sound';
import {
  Trophy,
  Bot,
  UserPlus,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  Swords,
  Mountain,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
} from 'lucide-react';

function getAgentPathCost(agent: Agent, costs: Map<string, number>): number {
  if (agent.result?.cost !== undefined) return agent.result.cost;
  if (!agent.result?.path || agent.result.path.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < agent.result.path.length; i++) {
    sum += costs.get(`${agent.result.path[i]!.x},${agent.result.path[i]!.y}`) ?? 1;
  }
  return sum;
}

export function RacerDock() {
  const [collapsed, setCollapsed] = useState(false);

  const agents = useAgentStore((s) => s.agents);
  const addAgent = useAgentStore((s) => s.addAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const toggleOverlay = useAgentStore((s) => s.toggleOverlay);
  const toggleAllOverlays = useAgentStore((s) => s.toggleAllOverlays);
  const showExploredNodes = useAgentStore((s) => s.showExploredNodes);
  const toggleExploredNodes = useAgentStore((s) => s.toggleExploredNodes);

  const start = useGridStore((s) => s.start);
  const goals = useGridStore((s) => s.goals);
  const costs = useGridStore((s) => s.costs);
  const showCostLabels = useGridStore((s) => s.showCostLabels);
  const toggleCostLabels = useGridStore((s) => s.toggleCostLabels);

  const raceStatus = useRaceStore((s) => s.status);
  const startRace = useRaceStore((s) => s.startRace);
  const pauseRace = useRaceStore((s) => s.pauseRace);
  const resetRace = useRaceStore((s) => s.resetRace);
  const isRacing = raceStatus === 'running';

  const allOverlaysVisible = agents.length > 0 && agents.every((a) => a.showOverlay);
  const someOverlaysVisible = agents.some((a) => a.showOverlay);

  const [selectedKey, setSelectedKey] = useState<string>('astar');
  const implemented = useMemo(() => getImplementedAlgorithms(), []);

  const handleAddAgent = () => {
    const entry = ALGORITHMS[selectedKey];
    if (!entry) return;
    addAgent(selectedKey, entry.color, start);
    playSnap();
  };

  const handleRaceAll = () => {
    agents.forEach((a) => removeAgent(a.id));
    Object.entries(ALGORITHMS).forEach(([key, entry]) => {
      addAgent(key, entry.color, start);
    });
    playSnap();
  };

  const handleQuickMatch = () => {
    agents.forEach((a) => removeAgent(a.id));
    if (ALGORITHMS.astar) {
      addAgent('astar', ALGORITHMS.astar.color, start);
    }
    if (ALGORITHMS.bfs) {
      addAgent('bfs', ALGORITHMS.bfs.color, start);
    }
    playSnap();
  };

  const handleClearAll = () => {
    agents.forEach((a) => removeAgent(a.id));
    playClick();
  };

  // Distance to the closest goal (Manhattan)
  const distToNearestGoal = useMemo(() => {
    return (p: { x: number; y: number }) =>
      Math.min(...goals.map((g) => Math.abs(p.x - g.x) + Math.abs(p.y - g.y)));
  }, [goals]);

  // Initial distance from start to goal (for progress calculation)
  const initialDist = useMemo(() => {
    return Math.max(1, distToNearestGoal(start));
  }, [distToNearestGoal, start]);

  // Ranked order for active race or results
  const ranked = useMemo(() => {
    return [...agents].sort((a, b) => {
      const aDone = a.result?.status === 'success';
      const bDone = b.result?.status === 'success';
      if (aDone && !bDone) return -1;
      if (!aDone && bDone) return 1;

      if (aDone && bDone) {
        const aCost = getAgentPathCost(a, costs);
        const bCost = getAgentPathCost(b, costs);
        if (aCost !== bCost) return aCost - bCost;
        const aLen = a.result?.path?.length ?? Infinity;
        const bLen = b.result?.path?.length ?? Infinity;
        if (aLen !== bLen) return aLen - bLen;
        return (a.result?.timeMs ?? 0) - (b.result?.timeMs ?? 0);
      }

      const distA = distToNearestGoal(a.position);
      const distB = distToNearestGoal(b.position);
      if (distA !== distB) return distA - distB;

      return a.visitedNodes.size - b.visitedNodes.size;
    });
  }, [agents, distToNearestGoal, costs]);

  const showStandingsMode = isRacing || agents.some((a) => a.result !== undefined);

  if (collapsed) {
    return (
      <div className="fixed right-3 top-16 z-20 pointer-events-auto select-none">
        <button
          onClick={() => {
            setCollapsed(false);
            playClick();
          }}
          className="brick-btn bg-[#F4F4F4] text-[#05131D] p-2.5 rounded-xl flex items-center gap-2 shadow-[0_4px_0_#05131D]"
          title="Expand Leaderboard Rail"
        >
          <ChevronLeft size={16} />
          <Trophy size={16} className="text-[#F2CD37]" />
          <span className="font-mono text-xs font-bold">{agents.length}</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="fixed right-3 top-16 bottom-20 z-20 pointer-events-auto w-72 flex flex-col bg-[#F4F4F4] border-[3px] border-[#05131D] rounded-2xl p-3 shadow-[0_8px_0_rgba(5,19,29,0.35)] text-[#05131D] select-none overflow-hidden transition-all animate-in fade-in duration-150">
      {/* 4 Raised Studs Header Affordance */}
      <div className="flex items-center justify-center gap-2 pb-2 border-b-2 border-[#05131D]/15">
        <div className="w-3 h-2 rounded-t-full bg-[#A3A2A4] border-2 border-b-0 border-[#05131D]" />
        <div className="w-3 h-2 rounded-t-full bg-[#A3A2A4] border-2 border-b-0 border-[#05131D]" />
        <div className="w-3 h-2 rounded-t-full bg-[#A3A2A4] border-2 border-b-0 border-[#05131D]" />
        <div className="w-3 h-2 rounded-t-full bg-[#A3A2A4] border-2 border-b-0 border-[#05131D]" />
      </div>

      {/* Dock Title Bar */}
      <div className="flex items-center justify-between py-1.5 border-b-2 border-[#05131D]/20">
        <div className="flex items-center gap-2">
          {showStandingsMode ? (
            <Trophy size={16} className="text-[#F2CD37]" />
          ) : (
            <Bot size={16} className="text-[#0055BF]" />
          )}
          <span className="text-xs font-black tracking-wider uppercase font-display">
            {showStandingsMode ? 'Live Standings' : `Racers (${agents.length})`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {agents.length > 0 && !isRacing && (
            <button
              onClick={handleClearAll}
              className="text-[10px] text-[#C91A09] hover:bg-[#C91A09]/10 px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer"
              title="Clear all placed racers"
            >
              Clear
            </button>
          )}

          {/* Collapse Button */}
          <button
            onClick={() => {
              setCollapsed(true);
              playClick();
            }}
            className="p-1 rounded text-[#595D60] hover:text-[#05131D] hover:bg-[#05131D]/10 transition-colors cursor-pointer"
            title="Collapse Rail"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Pre-Race Controls */}
      {!showStandingsMode && (
        <div className="flex flex-col gap-2 pt-2 pb-1 border-b-2 border-[#05131D]/15">
          {/* Quick Match Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRaceAll}
              className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-[#F2CD37] hover:bg-[#e0bc2c] border-2 border-[#05131D] text-[#05131D] text-xs font-bold shadow-[0_2px_0_#05131D] transition-transform active:translate-y-0.5 cursor-pointer"
              title="Add all algorithms to the grid"
            >
              <Trophy size={13} />
              <span>Race All {Object.keys(ALGORITHMS).length}</span>
            </button>
            <button
              onClick={handleQuickMatch}
              className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-[#F4F4F4] hover:bg-[#e8e8e8] border-2 border-[#05131D] text-[#05131D] text-xs font-bold shadow-[0_2px_0_#05131D] transition-transform active:translate-y-0.5 cursor-pointer"
              title="A* vs BFS duel"
            >
              <Swords size={13} className="text-[#C91A09]" />
              <span>Duel</span>
            </button>
          </div>

          {/* Add Racer Selector */}
          <div className="flex items-center gap-1.5 bg-[#e8e8e8] border-2 border-[#05131D] rounded-xl p-1.5">
            {/* Swatch of selected algorithm */}
            <span
              className="w-4 h-4 rounded-full border-2 border-[#05131D] shrink-0 shadow-sm"
              style={{ backgroundColor: ALGORITHMS[selectedKey]?.color ?? '#C91A09' }}
            />

            <div className="relative flex-1 min-w-0">
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-[#05131D] pr-5 appearance-none cursor-pointer focus:outline-none truncate font-sans"
              >
                {Object.entries(implemented).map(([key, entry]) => (
                  <option key={key} value={key} className="bg-[#F4F4F4] text-[#05131D]">
                    {entry.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[#595D60]"
              />
            </div>

            <button
              onClick={handleAddAgent}
              className="p-1 rounded-lg bg-[#0055BF] text-[#F4F4F4] border-2 border-[#05131D] hover:bg-[#0047a3] transition-colors shrink-0 shadow-[0_2px_0_#05131D] active:translate-y-0.5 cursor-pointer"
              title="Add racer to starting line"
            >
              <UserPlus size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Visuals Toolbar */}
      {agents.length > 0 && (
        <div className="flex items-center justify-between gap-1 py-1 px-2 rounded-xl bg-[#e8e8e8] border border-[#05131D]/20 text-[10px] font-mono mt-1 shrink-0">
          <span className="text-[#595D60] uppercase tracking-wider text-[9px] font-bold">
            Visuals
          </span>

          <div className="flex items-center gap-1">
            {/* Toggle All Overlays */}
            <button
              onClick={() => {
                toggleAllOverlays();
                playClick();
              }}
              className={`px-1.5 py-0.5 rounded-lg flex items-center gap-1 font-bold border transition-colors cursor-pointer ${
                allOverlaysVisible
                  ? 'bg-[#0055BF]/15 text-[#0055BF] border-[#0055BF]/30'
                  : someOverlaysVisible
                    ? 'bg-[#F4F4F4] text-[#05131D] border-[#05131D]'
                    : 'bg-[#F4F4F4] text-[#595D60] hover:text-[#05131D] border-[#A3A2A4]'
              }`}
              title={allOverlaysVisible ? 'Hide all scout overlays' : 'Show all scout overlays'}
            >
              {allOverlaysVisible || someOverlaysVisible ? (
                <Eye size={11} className="text-[#0055BF]" />
              ) : (
                <EyeOff size={11} className="text-[#595D60]" />
              )}
              <span>Overlays</span>
            </button>

            {/* Toggle Explored Nodes without hiding path trail */}
            <button
              onClick={() => {
                toggleExploredNodes();
                playClick();
              }}
              className={`px-1.5 py-0.5 rounded-lg flex items-center gap-1 font-bold border transition-colors cursor-pointer ${
                showExploredNodes
                  ? 'bg-[#237841]/15 text-[#237841] border-[#237841]/30'
                  : 'bg-[#F4F4F4] text-[#595D60] hover:text-[#05131D] border-[#A3A2A4]'
              }`}
              title={
                showExploredNodes
                  ? 'Hide explored nodes (keep path trail & waypoints)'
                  : 'Show explored nodes'
              }
            >
              <Layers size={11} className={showExploredNodes ? 'text-[#237841]' : 'text-[#595D60]'} />
              <span>{showExploredNodes ? 'Nodes' : 'Path'}</span>
            </button>

            {/* Toggle Tile Cost Numbers */}
            <button
              onClick={() => {
                toggleCostLabels();
                playClick();
              }}
              className={`px-1.5 py-0.5 rounded-lg flex items-center gap-1 font-bold border transition-colors cursor-pointer ${
                showCostLabels
                  ? 'bg-[#F2CD37]/30 text-[#AA7F2E] border-[#AA7F2E]'
                  : 'bg-[#F4F4F4] text-[#595D60] hover:text-[#05131D] border-[#A3A2A4]'
              }`}
              title={showCostLabels ? 'Hide tile cost numbers' : 'Show tile cost numbers'}
            >
              <Mountain size={11} className={showCostLabels ? 'text-[#AA7F2E]' : 'text-[#595D60]'} />
              <span>Costs</span>
            </button>
          </div>
        </div>
      )}

      {/* Racers List / Leaderboard Rows */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pt-2 pr-0.5 scrollbar-thin">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-center text-[#595D60] gap-1.5">
            <Bot size={24} className="opacity-40" />
            <span className="text-xs font-bold font-sans">No racers placed</span>
            <span className="text-[10px] text-[#A3A2A4]">
              Click &quot;Race All {Object.keys(ALGORITHMS).length}&quot; or add an algorithm above.
            </span>
          </div>
        ) : showStandingsMode ? (
          /* Live Standings Mode with Stud Medals & Mini Progress Bars */
          ranked.map((agent, index) => {
            const meta = ALGORITHMS[agent.algorithmKey];
            const label = meta ? meta.label : agent.algorithmKey;
            const dist = distToNearestGoal(agent.position);
            const nodesExplored = agent.result ? agent.result.nodesExplored : agent.visitedNodes.size;

            // Stud medal styling per §5.4 & §7
            let medalBg = 'bg-[#595D60] text-[#F4F4F4]';
            if (index === 0) medalBg = 'bg-[#F2CD37] text-[#05131D] font-black border-[#05131D]';
            else if (index === 1) medalBg = 'bg-[#A3A2A4] text-[#05131D] font-black border-[#05131D]';
            else if (index === 2) medalBg = 'bg-[#AA7F2E] text-[#F4F4F4] font-black border-[#05131D]';

            // Progress bar calculation
            const progressPct = agent.status === 'done'
              ? 100
              : Math.min(95, Math.max(5, Math.round(((initialDist - dist) / initialDist) * 100)));

            return (
              <div
                key={agent.id}
                className="flex flex-col gap-1 p-2 rounded-xl bg-white border-2 border-[#05131D] shadow-[0_2px_0_#05131D]"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Stud Medal Badge */}
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 border ${medalBg}`}
                    >
                      {index + 1}
                    </span>
                    {/* Torso Swatch */}
                    <span
                      className="w-3 h-3 rounded-full border-2 border-[#05131D] shrink-0 shadow-sm"
                      style={{ backgroundColor: agent.color }}
                    />
                    <span className="truncate font-bold text-[11px] font-sans">{label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                    {agent.status === 'running' && (
                      <span className="text-[#0055BF] font-bold">
                        {dist} left
                      </span>
                    )}
                    {agent.status === 'done' && agent.result?.status === 'success' && (
                      <span className="text-[#237841] flex items-center gap-0.5 font-bold">
                        <CheckCircle2 size={11} />
                        {agent.result.cost ?? agent.result.path?.length}c
                      </span>
                    )}
                    {agent.status === 'done' && agent.result?.status === 'trapped' && (
                      <span className="text-[#923978] flex items-center gap-0.5 font-bold">
                        <AlertTriangle size={11} />
                        trap
                      </span>
                    )}
                    {agent.status === 'done' && agent.result?.status === 'failed' && (
                      <span className="text-[#C91A09] flex items-center gap-0.5 font-bold">
                        <XCircle size={11} />
                        fail
                      </span>
                    )}

                    <span className="text-[#595D60] text-[9px]">{nodesExplored}n</span>

                    {/* Individual Overlay Toggle */}
                    <button
                      onClick={() => {
                        toggleOverlay(agent.id);
                        playClick();
                      }}
                      className={`p-0.5 rounded cursor-pointer ${
                        agent.showOverlay ? 'text-[#0055BF]' : 'text-[#A3A2A4]'
                      }`}
                      title={agent.showOverlay ? 'Hide scout overlay' : 'Show scout overlay'}
                    >
                      {agent.showOverlay ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  </div>
                </div>

                {/* Mini Progress Bar (6px height, per §7) */}
                <div className="w-full h-1.5 bg-[#A3A2A4]/40 rounded-full overflow-hidden border border-[#05131D]/20">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: agent.color,
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          /* Pre-Race Roster Mode */
          agents.map((agent) => {
            const meta = ALGORITHMS[agent.algorithmKey];
            const label = meta ? meta.label : agent.algorithmKey;

            return (
              <div
                key={agent.id}
                className="flex items-center justify-between p-2 rounded-xl bg-white border-2 border-[#05131D] text-xs shadow-[0_2px_0_#05131D]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-4 h-4 rounded-full border-2 border-[#05131D] shrink-0 shadow-sm"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span className="truncate font-bold text-[11px] font-sans">{label}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Overlay Eye Toggle */}
                  <button
                    onClick={() => {
                      toggleOverlay(agent.id);
                      playClick();
                    }}
                    className={`p-1 rounded cursor-pointer transition-colors ${
                      agent.showOverlay
                        ? 'text-[#0055BF]'
                        : 'text-[#A3A2A4] hover:text-[#05131D]'
                    }`}
                    title={agent.showOverlay ? 'Hide scout overlay' : 'Show scout overlay'}
                  >
                    {agent.showOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>

                  {/* Remove Racer */}
                  <button
                    onClick={() => {
                      removeAgent(agent.id);
                      playClick();
                    }}
                    className="p-1 rounded text-[#A3A2A4] hover:text-[#C91A09] transition-colors cursor-pointer"
                    title="Remove racer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action Bar: Reset & Start */}
      <div className="pt-2 mt-auto border-t-2 border-[#05131D]/20 flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            resetRace();
            playClick();
          }}
          disabled={agents.length === 0}
          className="brick-btn flex-1 py-1.5 px-2 rounded-xl bg-[#A3A2A4] text-[#05131D] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Reset Race [R]"
        >
          <RotateCcw size={13} />
          <span>Reset</span>
        </button>

        <button
          onClick={() => {
            if (isRacing) {
              pauseRace();
              playClick();
            } else {
              if (agents.length === 0) return;
              startRace();
              playStartFanfare();
            }
          }}
          disabled={agents.length === 0}
          className={`brick-btn flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            isRacing
              ? 'bg-[#595D60] text-[#F4F4F4]'
              : 'bg-[#C91A09] text-[#F4F4F4]'
          }`}
          title={agents.length > 0 ? (isRacing ? 'Pause [Space]' : 'Start [Space]') : 'Add racers first'}
        >
          {isRacing ? <Pause size={13} /> : <Play size={13} className="fill-current" />}
          <span>{isRacing ? 'Pause' : 'Start'}</span>
        </button>
      </div>
    </aside>
  );
}
