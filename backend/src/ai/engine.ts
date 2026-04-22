import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { AIMove } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type PendingCommand = {
  expect: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
};

type MoveCandidate = {
  bestMove: string;
  evaluation: number;
  depth: number;
  pvRank: number;
};

type DifficultyProfile = {
  skillLevel: number;
  depth: number;
  moveTime: number;
  multiPv: number;
  delayRangeMs: [number, number];
  rankWeights: number[];
  blunderChance: number;
};

function resolveDefaultEnginePath() {
  const vendorRoot = path.resolve(__dirname, '../../vendor/stockfish');

  if (!fs.existsSync(vendorRoot)) {
    throw new Error(`Stockfish directory not found at ${vendorRoot}`);
  }

  const executable = fs.readdirSync(vendorRoot).find((fileName) => {
    if (process.platform === 'win32') {
      return /^stockfish.*\.exe$/i.test(fileName);
    }

    return /^stockfish/i.test(fileName) && fs.statSync(path.join(vendorRoot, fileName)).isFile();
  });

  if (!executable) {
    throw new Error(`Stockfish executable not found in ${vendorRoot}`);
  }

  return path.join(vendorRoot, executable);
}

export class ChessAI {
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly executablePath: string;
  private readonly pendingCommands: PendingCommand[] = [];
  private readonly initPromise: Promise<void>;
  private initError: Error | null = null;
  private stdoutBuffer = '';
  private latestEvaluation = 0;
  private latestDepth = 0;
  private latestCandidates = new Map<number, MoveCandidate>();
  private commandChain: Promise<unknown> = Promise.resolve();

  constructor() {
    this.executablePath = process.env.STOCKFISH_PATH || resolveDefaultEnginePath();
    this.initPromise = this.initialize().catch((error) => {
      this.initError = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to initialize Stockfish:', this.initError.message);
    });
  }

  private async initialize() {
    this.process = spawn(this.executablePath, [], {
      cwd: path.dirname(this.executablePath),
      stdio: 'pipe',
      windowsHide: true,
    });

    this.process.stdout.setEncoding('utf8');
    this.process.stderr.setEncoding('utf8');

    this.process.stdout.on('data', (chunk: string) => {
      this.stdoutBuffer += chunk;
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        this.handleEngineLine(line);
      }
    });

    this.process.stderr.on('data', (chunk: string) => {
      const message = chunk.toString().trim();
      if (message) {
        console.error('[stockfish]', message);
      }
    });

    this.process.on('exit', (code) => {
      const error = new Error(`Stockfish exited unexpectedly with code ${code ?? 'unknown'}`);
      while (this.pendingCommands.length > 0) {
        this.pendingCommands.shift()?.reject(error);
      }
      this.process = null;
    });

    this.sendRaw('uci');
    await this.waitForLine((line) => line === 'uciok');
    this.sendRaw('isready');
    await this.waitForLine((line) => line === 'readyok');
  }

  private handleEngineLine(line: string) {
    if (line.startsWith('info ')) {
      const depthMatch = line.match(/\bdepth\s+(\d+)/);
      const depth = depthMatch ? Number(depthMatch[1]) : this.latestDepth;

      if (depthMatch) {
        this.latestDepth = depth;
      }

      const evaluation = this.extractEvaluation(line);
      if (evaluation !== null) {
        this.latestEvaluation = evaluation;
      }

      const candidate = this.parseCandidate(line, depth);
      if (candidate) {
        this.latestCandidates.set(candidate.pvRank, candidate);
      }
    }

    const pending = this.pendingCommands[0];
    if (pending && pending.expect(line)) {
      this.pendingCommands.shift();
      pending.resolve(line);
    }
  }

  private waitForLine(expect: (line: string) => boolean) {
    return new Promise<string>((resolve, reject) => {
      this.pendingCommands.push({ expect, resolve, reject });
    });
  }

  private sendRaw(command: string) {
    if (!this.process) {
      throw new Error('Stockfish process is not running');
    }

    this.process.stdin.write(`${command}\n`);
  }

  private extractEvaluation(line: string) {
    const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
    if (mateMatch) {
      return Number(mateMatch[1]) > 0 ? 100 : -100;
    }

    const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
    if (cpMatch) {
      return Number(cpMatch[1]) / 100;
    }

    return null;
  }

  private parseCandidate(line: string, depth: number) {
    const pvMatch = line.match(/\bpv\s+(\S+)/);
    if (!pvMatch) {
      return null;
    }

    const bestMove = pvMatch[1];
    if (!bestMove || bestMove === '(none)') {
      return null;
    }

    const evaluation = this.extractEvaluation(line);
    if (evaluation === null) {
      return null;
    }

    const pvRank = Number(line.match(/\bmultipv\s+(\d+)/)?.[1] || 1);

    return {
      bestMove,
      evaluation,
      depth,
      pvRank,
    };
  }

  private getDifficultyProfile(difficulty: number): DifficultyProfile {
    const profiles: DifficultyProfile[] = [
      { skillLevel: 0, depth: 1, moveTime: 45, multiPv: 5, delayRangeMs: [2200, 3200], rankWeights: [0, 0.03, 0.1, 0.25, 0.62], blunderChance: 0.72 },
      { skillLevel: 0, depth: 1, moveTime: 65, multiPv: 5, delayRangeMs: [2100, 3000], rankWeights: [0.01, 0.06, 0.17, 0.29, 0.47], blunderChance: 0.6 },
      { skillLevel: 1, depth: 2, moveTime: 90, multiPv: 5, delayRangeMs: [1900, 2800], rankWeights: [0.03, 0.1, 0.22, 0.28, 0.37], blunderChance: 0.5 },
      { skillLevel: 2, depth: 2, moveTime: 140, multiPv: 5, delayRangeMs: [1800, 2600], rankWeights: [0.1, 0.18, 0.26, 0.24, 0.22], blunderChance: 0.38 },
      { skillLevel: 3, depth: 3, moveTime: 190, multiPv: 5, delayRangeMs: [1700, 2400], rankWeights: [0.18, 0.24, 0.24, 0.19, 0.15], blunderChance: 0.3 },
      { skillLevel: 4, depth: 4, moveTime: 260, multiPv: 5, delayRangeMs: [1500, 2200], rankWeights: [0.26, 0.28, 0.22, 0.14, 0.1], blunderChance: 0.24 },
      { skillLevel: 6, depth: 5, moveTime: 360, multiPv: 5, delayRangeMs: [1300, 2000], rankWeights: [0.38, 0.27, 0.18, 0.1, 0.07], blunderChance: 0.18 },
      { skillLevel: 7, depth: 6, moveTime: 480, multiPv: 5, delayRangeMs: [1150, 1850], rankWeights: [0.48, 0.25, 0.15, 0.08, 0.04], blunderChance: 0.14 },
      { skillLevel: 9, depth: 7, moveTime: 620, multiPv: 4, delayRangeMs: [950, 1600], rankWeights: [0.58, 0.24, 0.12, 0.06], blunderChance: 0.11 },
      { skillLevel: 11, depth: 8, moveTime: 800, multiPv: 4, delayRangeMs: [850, 1450], rankWeights: [0.68, 0.2, 0.09, 0.03], blunderChance: 0.08 },
      { skillLevel: 13, depth: 10, moveTime: 1050, multiPv: 4, delayRangeMs: [700, 1250], rankWeights: [0.78, 0.16, 0.05, 0.01], blunderChance: 0.06 },
      { skillLevel: 15, depth: 12, moveTime: 1350, multiPv: 3, delayRangeMs: [550, 1100], rankWeights: [0.86, 0.11, 0.03], blunderChance: 0.04 },
      { skillLevel: 17, depth: 14, moveTime: 1700, multiPv: 3, delayRangeMs: [420, 900], rankWeights: [0.91, 0.07, 0.02], blunderChance: 0.03 },
      { skillLevel: 19, depth: 18, moveTime: 2200, multiPv: 2, delayRangeMs: [260, 700], rankWeights: [0.96, 0.04], blunderChance: 0.015 },
      { skillLevel: 20, depth: 22, moveTime: 2800, multiPv: 2, delayRangeMs: [180, 520], rankWeights: [0.985, 0.015], blunderChance: 0.005 },
    ];

    return profiles[difficulty - 1] || profiles[3];
  }

  private getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getDelayMs(profile: DifficultyProfile) {
    const [minDelay, maxDelay] = profile.delayRangeMs;
    let delay = this.getRandomInt(minDelay, maxDelay);

    if (Math.random() < 0.12) {
      delay += this.getRandomInt(120, 420);
    }

    return delay;
  }

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getWeightedRandomIndex(weights: number[]) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) {
      return 0;
    }

    let threshold = Math.random() * totalWeight;
    for (let index = 0; index < weights.length; index += 1) {
      threshold -= weights[index];
      if (threshold <= 0) {
        return index;
      }
    }

    return weights.length - 1;
  }

  private chooseMove(candidates: MoveCandidate[], profile: DifficultyProfile) {
    const usableCandidates = candidates.slice(0, Math.min(profile.multiPv, candidates.length));
    if (usableCandidates.length === 0) {
      throw new Error('Stockfish did not return any move candidates');
    }

    if (usableCandidates.length === 1) {
      return usableCandidates[0];
    }

    if (Math.random() < profile.blunderChance) {
      const badMovePool = usableCandidates.slice(Math.max(1, usableCandidates.length - 2));
      return badMovePool[this.getRandomInt(0, badMovePool.length - 1)];
    }

    const weights = usableCandidates.map((_, index) => profile.rankWeights[index] || 0);
    return usableCandidates[this.getWeightedRandomIndex(weights)];
  }

  private async analyzePosition(fen: string, profile: DifficultyProfile, multiPvOverride?: number) {
    this.latestDepth = 0;
    this.latestEvaluation = 0;
    this.latestCandidates.clear();

    const multiPv = Math.max(1, Math.min(5, multiPvOverride ?? profile.multiPv));

    this.sendRaw('isready');
    await this.waitForLine((line) => line === 'readyok');
    this.sendRaw('ucinewgame');
    this.sendRaw(`setoption name Skill Level value ${profile.skillLevel}`);
    this.sendRaw(`setoption name MultiPV value ${multiPv}`);
    this.sendRaw(`position fen ${fen}`);
    this.sendRaw(`go depth ${profile.depth} movetime ${profile.moveTime}`);

    const bestMoveLine = await this.waitForLine((line) => line.startsWith('bestmove '));
    const fallbackBestMove = bestMoveLine.match(/^bestmove\s+(\S+)/)?.[1];
    const candidates = Array.from(this.latestCandidates.values()).sort((left, right) => left.pvRank - right.pvRank);

    if (candidates.length > 0) {
      return candidates;
    }

    if (!fallbackBestMove || fallbackBestMove === '(none)') {
      throw new Error('Stockfish did not return a legal move');
    }

    return [{
      bestMove: fallbackBestMove,
      evaluation: this.latestEvaluation,
      depth: this.latestDepth || profile.depth,
      pvRank: 1,
    }];
  }

  async getBestMove(fen: string, difficulty: number = 4): Promise<AIMove> {
    await this.initPromise;

    if (this.initError) {
      throw new Error(`AI engine unavailable: ${this.initError.message}`);
    }

    const level = Math.max(1, Math.min(15, difficulty));
    const profile = this.getDifficultyProfile(level);

    const runAnalysis = async () => {
      const candidates = await this.analyzePosition(fen, profile);
      const selectedMove = this.chooseMove(candidates, profile);
      const delayMs = this.getDelayMs(profile);

      await this.delay(delayMs);

      return {
        bestMove: selectedMove.bestMove,
        evaluation: selectedMove.evaluation,
        depth: selectedMove.depth || profile.depth,
        pvRank: selectedMove.pvRank,
        delayMs,
        skillLevel: profile.skillLevel,
      };
    };

    const queuedAnalysis = this.commandChain.then(runAnalysis, runAnalysis);
    this.commandChain = queuedAnalysis.then(() => undefined, () => undefined);
    return queuedAnalysis;
  }

  async getTopMoves(fen: string, count: number = 5): Promise<AIMove[]> {
    await this.initPromise;

    if (this.initError) {
      throw new Error(`AI engine unavailable: ${this.initError.message}`);
    }

    const profile = this.getDifficultyProfile(15);
    const maxCount = Math.max(1, Math.min(5, count));

    const runAnalysis = async () => {
      const candidates = await this.analyzePosition(fen, profile, maxCount);
      return candidates.slice(0, maxCount).map((candidate) => ({
        bestMove: candidate.bestMove,
        evaluation: candidate.evaluation,
        depth: candidate.depth,
        pvRank: candidate.pvRank,
        skillLevel: profile.skillLevel,
      }));
    };

    const queuedAnalysis = this.commandChain.then(runAnalysis, runAnalysis);
    this.commandChain = queuedAnalysis.then(() => undefined, () => undefined);
    return queuedAnalysis;
  }

  dispose() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

let aiInstance: ChessAI | null = null;

export function createAI(): ChessAI {
  if (!aiInstance) {
    aiInstance = new ChessAI();
  }

  return aiInstance;
}
