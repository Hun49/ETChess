export interface PgnOptions {
  event?: string;
  site?: string;
  date?: string; // YYYY.MM.DD
  round?: string;
  white: string;
  black: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  whiteElo?: number;
  blackElo?: number;
  timeControl?: string;
  termination?: string;
  moves: string[]; // SAN moves
}

/**
 * Builds a standardized PGN string with standard Seven Tag Roster and move text.
 */
export function buildPgn(options: PgnOptions): string {
  const dateStr = options.date || new Date().toISOString().split("T")[0].replace(/-/g, ".");

  const headers = [
    `[Event "${options.event || "ET Chess Match"}"]`,
    `[Site "${options.site || "https://etchess.com"}"]`,
    `[Date "${dateStr}"]`,
    `[Round "${options.round || "1"}"]`,
    `[White "${options.white}"]`,
    `[Black "${options.black}"]`,
    `[Result "${options.result}"]`,
  ];

  if (options.whiteElo !== undefined) {
    headers.push(`[WhiteElo "${options.whiteElo}"]`);
  }
  if (options.blackElo !== undefined) {
    headers.push(`[BlackElo "${options.blackElo}"]`);
  }
  if (options.timeControl) {
    headers.push(`[TimeControl "${options.timeControl}"]`);
  }
  if (options.termination) {
    headers.push(`[Termination "${options.termination}"]`);
  }

  // Format move list into standard PGN text: 1. e4 e5 2. Nf3 Nc6 ...
  const moveTokens: string[] = [];
  for (let i = 0; i < options.moves.length; i++) {
    if (i % 2 === 0) {
      const moveNumber = Math.floor(i / 2) + 1;
      moveTokens.push(`${moveNumber}.`);
    }
    moveTokens.push(options.moves[i]);
  }

  if (options.result) {
    moveTokens.push(options.result);
  }

  return `${headers.join("\n")}\n\n${moveTokens.join(" ")}\n`;
}
