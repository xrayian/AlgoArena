/**
 * TopBar — Brick Racer Command Header.
 *
 * Implements Section 5.2 of the UI/UX Guidelines:
 * - Fixed height ~56px, Dark Bluish Grey (#595D60) background, 3px black bottom border.
 * - Left side: 7 fixed racer chips in canonical order (A*, Dij, BFS, DFS, Gdy, Hill, SA),
 *   dimming to 40% when done.
 * - Right side: Race timer (mono numerals), bouncy Brick Yellow Stud Counter badge,
 *   camera controls, sound toggle, and tactile Pause [ESC] button.
 *
 * @module ui/TopBar
 */

import { useState, useEffect, useMemo } from 'react';
import { useGridStore } from '../state/gridStore';
import { useRaceStore } from '../state/raceStore';
import { useAgentStore } from '../state/agentStore';
import { useCameraStore } from '../state/cameraStore';
import { useSoundStore } from '../state/soundStore';
import { useGameMenuStore } from '../state/gameMenuStore';
import { ALGORITHMS } from '../algorithms';
import { playClick, playSnap } from '../utils/sound';
import {
  Pause,
  Compass,
  Grid,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  HelpCircle,
  Timer,
} from 'lucide-react';

const RACER_CHIPS = [
  { key: 'astar', short: 'A*', label: 'A* Search', color: '#C91A09' },
  { key: 'dijkstra', short: 'Dij', label: "Dijkstra's", color: '#0055BF' },
  { key: 'bfs', short: 'BFS', label: 'Breadth-First', color: '#F2CD37' },
  { key: 'dfs', short: 'DFS', label: 'Depth-First', color: '#4B9F4A' },
  { key: 'greedy', short: 'Gdy', label: 'Greedy Best-First', color: '#FE8A18' },
  { key: 'hillclimb', short: 'Hill', label: 'Hill Climbing', color: '#923978' },
  { key: 'annealing', short: 'SA', label: 'Simulated Annealing', color: '#36AEBF' },
] as const;

interface TopBarProps {
  onOpenHelp?: () => void;
}

export function TopBar({ onOpenHelp }: TopBarProps = {}) {
  const openPauseMenu = useGameMenuStore((s) => s.openPauseMenu);

  const raceStatus = useRaceStore((s) => s.status);
  const isRunning = raceStatus === 'running';
  const stepCount = useRaceStore((s) => s.stepCount);

  const agents = useAgentStore((s) => s.agents);
  const toggleOverlay = useAgentStore((s) => s.toggleOverlay);
  const addAgent = useAgentStore((s) => s.addAgent);
  const start = useGridStore((s) => s.start);

  const isTopDown = useCameraStore((s) => s.isTopDown);
  const triggerResetCamera = useCameraStore((s) => s.triggerReset);
  const triggerTopDown = useCameraStore((s) => s.triggerPreset);
  const triggerZoomIn = useCameraStore((s) => s.triggerZoomIn);
  const triggerZoomOut = useCameraStore((s) => s.triggerZoomOut);

  const soundEnabled = useSoundStore((s) => s.enabled);
  const toggleSound = useSoundStore((s) => s.toggleSound);

  // Timer tracking
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const t0 = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const activeElapsed = raceStatus === 'idle' && stepCount === 0 ? 0 : elapsedSec;

  const formattedTime = useMemo(() => {
    const mins = Math.floor(activeElapsed / 60);
    const secs = activeElapsed % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [activeElapsed]);

  // Total studs explored across all racers
  const totalStuds = useMemo(() => {
    return agents.reduce((acc, a) => acc + a.visitedNodes.size, 0);
  }, [agents]);

  // Fast lookup of placed agents by algorithmKey
  const agentByAlgKey = useMemo(() => {
    const map = new Map<string, typeof agents[0]>();
    for (const a of agents) {
      map.set(a.algorithmKey, a);
    }
    return map;
  }, [agents]);

  return (
    <header className="fixed top-0 inset-x-0 h-14 bg-[#F4F4F4] border-b-[3px] border-[#05131D] z-30 flex items-center justify-between px-3 text-[#05131D] shadow-md select-none">
      {/* Left side: 7 fixed racer chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
        {RACER_CHIPS.map((chip) => {
          const agent = agentByAlgKey.get(chip.key);
          const isPlaced = !!agent;
          const isDone = agent?.status === 'done';
          const isSelected = agent?.showOverlay ?? false;

          return (
            <button
              key={chip.key}
              onClick={() => {
                if (agent) {
                  toggleOverlay(agent.id);
                  playClick();
                } else {
                  const entry = ALGORITHMS[chip.key];
                  if (entry) {
                    addAgent(chip.key, entry.color, start);
                    playSnap();
                  }
                }
              }}
              title={
                isPlaced
                  ? `${chip.label} (${agent.status}) — Click to toggle overlay`
                  : `${chip.label} — Click to add racer to board`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 transition-all font-sans font-bold text-xs cursor-pointer ${
                isPlaced
                  ? isDone
                    ? 'opacity-40 border-[#05131D] bg-[#E8E8E8] text-[#595D60]'
                    : isSelected
                      ? 'border-[#05131D] bg-white text-[#05131D] ring-2 ring-[#0055BF] shadow-[0_2px_0_#05131D]'
                      : 'border-[#05131D] bg-white text-[#05131D] hover:bg-[#E8E8E8] shadow-[0_2px_0_#05131D]'
                  : 'opacity-35 border-dashed border-[#A3A2A4] bg-transparent text-[#595D60] hover:opacity-75'
              }`}
            >
              {/* Torso colored stud pip */}
              <span
                className="w-3.5 h-3.5 rounded-full border-2 border-[#05131D] shadow-sm shrink-0"
                style={{ backgroundColor: chip.color }}
              />
              <span className="text-[11px] font-bold tracking-tight">
                {chip.short}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right side: Timer, Stud Counter, Controls & Pause */}
      <div className="flex items-center gap-2 pl-2">
        {/* Race Timer */}
        <div
          className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border-2 border-[#05131D] font-mono text-xs font-bold text-[#05131D] shadow-[0_2px_0_#05131D]"
          title="Elapsed Race Time"
        >
          <Timer size={13} className="text-[#AA7F2E]" />
          <span>{formattedTime}</span>
        </div>

        {/* Brick Yellow Stud Counter Badge with bounce animation */}
        <div
          key={totalStuds}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F2CD37] border-2 border-[#05131D] text-[#05131D] font-bold text-xs shadow-[0_2px_0_#05131D] animate-in zoom-in-95 duration-100"
          title="Total board studs explored across all racers"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#AA7F2E] border border-[#05131D] shrink-0" />
          <span className="font-mono">{totalStuds}</span>
          <span className="text-[10px] uppercase font-display tracking-wider hidden md:inline">studs</span>
        </div>

        <div className="h-6 w-[2px] bg-[#05131D]/15 mx-0.5 hidden sm:block" />

        {/* Camera controls in light container */}
        <div className="hidden sm:flex items-center gap-1 bg-white rounded-xl p-0.5 border-2 border-[#05131D] shadow-[0_2px_0_#05131D]">
          <button
            onClick={() => {
              triggerResetCamera();
              playClick();
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              !isTopDown
                ? 'bg-[#0055BF] text-[#F4F4F4] font-bold shadow-sm'
                : 'text-[#595D60] hover:text-[#05131D]'
            }`}
            title="Reset Isometric 3D View [I]"
          >
            <Compass size={13} />
          </button>
          <button
            onClick={() => {
              triggerTopDown('top');
              playClick();
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isTopDown
                ? 'bg-[#0055BF] text-[#F4F4F4] font-bold shadow-sm'
                : 'text-[#595D60] hover:text-[#05131D]'
            }`}
            title="Top-Down 2D View [T]"
          >
            <Grid size={13} />
          </button>
          <button
            onClick={() => {
              triggerZoomOut();
              playClick();
            }}
            className="p-1.5 rounded-lg text-[#595D60] hover:text-[#05131D] transition-colors cursor-pointer"
            title="Zoom Out [-]"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={() => {
              triggerZoomIn();
              playClick();
            }}
            className="p-1.5 rounded-lg text-[#595D60] hover:text-[#05131D] transition-colors cursor-pointer"
            title="Zoom In [+]"
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* Audio Toggle */}
        <button
          onClick={() => {
            toggleSound();
            playClick();
          }}
          className={`p-1.5 rounded-xl border-2 border-[#05131D] bg-white transition-colors shadow-[0_2px_0_#05131D] cursor-pointer ${
            soundEnabled ? 'text-[#AA7F2E]' : 'text-[#A3A2A4]'
          }`}
          title={soundEnabled ? 'Mute Sound (Click to Silence)' : 'Unmute Sound'}
        >
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>

        {/* Field Manual Help */}
        {onOpenHelp && (
          <button
            onClick={() => {
              onOpenHelp();
              playClick();
            }}
            className="p-1.5 rounded-xl border-2 border-[#05131D] bg-white text-[#595D60] hover:text-[#05131D] transition-colors shadow-[0_2px_0_#05131D] cursor-pointer"
            title="Field Manual & Controls [?]"
          >
            <HelpCircle size={14} />
          </button>
        )}

        {/* Tactile Pause Button [ESC] */}
        <button
          onClick={() => {
            openPauseMenu();
            playClick();
          }}
          className="brick-btn bg-white hover:bg-[#E8E8E8] text-[#05131D] px-2.5 py-1 rounded-xl flex items-center gap-1.5 ml-1 text-xs cursor-pointer font-bold shadow-[0_2px_0_#05131D]"
          title="Pause Menu [ESC]"
        >
          <Pause size={12} className="text-[#C91A09]" />
          <span>PAUSE</span>
          <kbd className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-[#05131D]/10 text-[#05131D]/80">
            ESC
          </kbd>
        </button>
      </div>
    </header>
  );
}
