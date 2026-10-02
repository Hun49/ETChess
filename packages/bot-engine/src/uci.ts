export function formatSetOption(name: string, value: string | number | boolean): string {
  return `setoption name ${name} value ${value}`;
}

export function formatPositionFen(fen: string, moves?: string[]): string {
  if (moves && moves.length > 0) {
    return `position fen ${fen} moves ${moves.join(" ")}`;
  }
  return `position fen ${fen}`;
}

export function formatPositionStartpos(moves?: string[]): string {
  if (moves && moves.length > 0) {
    return `position startpos moves ${moves.join(" ")}`;
  }
  return "position startpos";
}

export function formatGo(options: {
  depth?: number;
  movetime?: number;
  nodes?: number;
}): string {
  const parts: string[] = ["go"];
  if (options.depth !== undefined) parts.push(`depth ${options.depth}`);
  if (options.movetime !== undefined) parts.push(`movetime ${options.movetime}`);
  if (options.nodes !== undefined) parts.push(`nodes ${options.nodes}`);
  return parts.join(" ");
}

export function parseBestMove(line: string): { bestmove: string; ponder?: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("bestmove")) return null;

  const tokens = trimmed.split(/\s+/);
  const bestmove = tokens[1];
  if (!bestmove || bestmove === "(none)") return null;

  let ponder: string | undefined;
  if (tokens[2] === "ponder" && tokens[3]) {
    ponder = tokens[3];
  }

  return { bestmove, ponder };
}

export function parseInfo(line: string): {
  depth?: number;
  scoreCp?: number;
  scoreMate?: number;
  nodes?: number;
} | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("info")) return null;

  const tokens = trimmed.split(/\s+/);
  const result: {
    depth?: number;
    scoreCp?: number;
    scoreMate?: number;
    nodes?: number;
  } = {};

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "depth" && tokens[i + 1]) {
      result.depth = Number.parseInt(tokens[i + 1], 10);
    } else if (tokens[i] === "score" && tokens[i + 1] === "cp" && tokens[i + 2]) {
      result.scoreCp = Number.parseInt(tokens[i + 2], 10);
    } else if (tokens[i] === "score" && tokens[i + 1] === "mate" && tokens[i + 2]) {
      result.scoreMate = Number.parseInt(tokens[i + 2], 10);
    } else if (tokens[i] === "nodes" && tokens[i + 1]) {
      result.nodes = Number.parseInt(tokens[i + 1], 10);
    }
  }

  return result;
}
