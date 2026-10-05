/**
 * Canonical Staunton Chess Piece Artwork (Classic Set).
 * Based on Wikimedia Commons Standard SVG Chess Pieces by Colin M.L. Burnett.
 * License: Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0).
 */

export type PieceColor = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceSymbol = `${PieceColor}${Uppercase<PieceType>}`;

export const PIECE_ATTRIBUTION = {
  designer: "Colin M.L. Burnett",
  source: "Wikimedia Commons Standard SVG Chess Pieces / cm-chessboard",
  license: "CC BY-SA 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
};

export const CLASSIC_PIECE_SVG_BODIES: Record<PieceSymbol, string> = {
  wP: `<path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="miter" />`,
  bP: `<path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" fill="#000000" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="miter" />`,
  wN: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="m 22,10 c 10.5,1 16.5,8 16,29 H 15 c 0,-9 10,-6.5 8,-21" fill="#ffffff" />
    <path d="m 24,18 c 0.38,2.91 -5.55,7.37 -8,9 -3,2 -2.82,4.34 -5,4 -1.042,-0.94 1.41,-3.04 0,-3 -1,0 0.19,1.23 -1,2 -1,0 -4.003,1 -4,-4 0,-2 6,-12 6,-12 0,0 1.89,-1.9 2,-3.5 0,-1 1.5,-1.5 2.5,-1.5 1,0 2.5,1 2.5,1.5 0,1.5 0.5,2.5 2,2.5 1.5,0 2.5,-1 3,-2.5 z" fill="#ffffff" />
    <path d="m 9.5,25.5 a 0.5,0.5 0 1 1 -1,0 0.5,0.5 0 1 1 1,0 z" fill="#000000" />
    <path d="m 15,15.5 a 0.5,1.5 0 1 1 -1,0 0.5,1.5 0 1 1 1,0 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" fill="#000000" />
  </g>`,
  bN: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="m 22,10 c 10.5,1 16.5,8 16,29 H 15 c 0,-9 10,-6.5 8,-21" fill="#000000" />
    <path d="m 24,18 c 0.38,2.91 -5.55,7.37 -8,9 -3,2 -2.82,4.34 -5,4 -1.042,-0.94 1.41,-3.04 0,-3 -1,0 0.19,1.23 -1,2 -1,0 -4.003,1 -4,-4 0,-2 6,-12 6,-12 0,0 1.89,-1.9 2,-3.5 0,-1 1.5,-1.5 2.5,-1.5 1,0 2.5,1 2.5,1.5 0,1.5 0.5,2.5 2,2.5 1.5,0 2.5,-1 3,-2.5 z" fill="#000000" />
    <path d="m 9.5,25.5 a 0.5,0.5 0 1 1 -1,0 0.5,0.5 0 1 1 1,0 z" fill="#ececec" />
    <path d="m 15,15.5 a 0.5,1.5 0 1 1 -1,0 0.5,1.5 0 1 1 1,0 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" fill="#ececec" />
    <path d="M 24.55,10.4 C 24.26,11.96 23.32,13 22,13 20.68,13 19.86,11.96 19.5,10.4 19.14,8.84 19.24,7 20.75,7 c 1.51,0 1.61,1.84 1.25,3.4 z" stroke="#ececec" stroke-width="1.5" />
  </g>`,
  wB: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g fill="#ffffff" stroke-linecap="butt">
      <path d="m 9,36 c 3.39,-0.97 10.11,0.43 13.5,-2 3.39,2.43 10.11,1.03 13.5,2 0,0 1.65,0.54 3,2 -0.68,0.97 -1.65,0.99 -3,1 -3.39,-0.21 -10.11,0.86 -13.5,-1 -3.39,1.86 -10.11,0.79 -13.5,1 -1.35,-0.01 -2.32,-0.03 -3,-1 1.35,-1.46 3,-2 3,-2 z" />
      <path d="m 15,32 c 2.5,2.5 12.5,2.5 15,0 0.5,-1.5 0,-2 0,-2 0,-2.5 -2.5,-4 -2.5,-4 5.5,-1.5 6,-11.5 -5,-15.5 -11,4 -10.5,14 -5,15.5 0,0 -2.5,1.5 -2.5,4 0,0 -0.5,0.5 0,2 z" />
      <path d="m 25,8 a 2.5,2.5 0 1 1 -5,0 2.5,2.5 0 1 1 5,0 z" />
    </g>
    <path d="m 17.5,26 h 10 M 15,30 h 15" stroke-linejoin="miter" />
    <path d="m 22.5,15.5 v 5 M 20,18 h 5" stroke-linejoin="miter" />
  </g>`,
  bB: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g fill="#000000" stroke-linecap="butt">
      <path d="m 9,36 c 3.39,-0.97 10.11,0.43 13.5,-2 3.39,2.43 10.11,1.03 13.5,2 0,0 1.65,0.54 3,2 -0.68,0.97 -1.65,0.99 -3,1 -3.39,-0.21 -10.11,0.86 -13.5,-1 -3.39,1.86 -10.11,0.79 -13.5,1 -1.35,-0.01 -2.32,-0.03 -3,-1 1.35,-1.46 3,-2 3,-2 z" />
      <path d="m 15,32 c 2.5,2.5 12.5,2.5 15,0 0.5,-1.5 0,-2 0,-2 0,-2.5 -2.5,-4 -2.5,-4 5.5,-1.5 6,-11.5 -5,-15.5 -11,4 -10.5,14 -5,15.5 0,0 -2.5,1.5 -2.5,4 0,0 -0.5,0.5 0,2 z" />
      <path d="m 25,8 a 2.5,2.5 0 1 1 -5,0 2.5,2.5 0 1 1 5,0 z" />
    </g>
    <path d="m 17.5,26 h 10 M 15,30 h 15" stroke="#ececec" stroke-linejoin="miter" />
    <path d="m 22.5,15.5 v 5 M 20,18 h 5" stroke="#ececec" stroke-linejoin="miter" />
  </g>`,
  wR: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 9,39 H 36 V 36 H 9 Z" fill="#ffffff" stroke-linecap="butt" />
    <path d="m 12,36 v -4 h 21 v 4 z" fill="#ffffff" stroke-linecap="butt" />
    <path d="m 11,14 v 4 h 23 v -4 z" fill="#ffffff" stroke-linecap="butt" />
    <path d="m 12,18 v 14 h 21 v -14 z" fill="#ffffff" stroke-linecap="butt" />
    <path d="m 9,9 v 5 h 4.5 v -3 h 4 v 3 h 5 v -3 h 4 v 3 H 36 V 9 Z" fill="#ffffff" stroke-linecap="butt" />
    <path d="M 12,36 H 33 M 11,14 H 34 M 14,23.5 H 31" stroke-linejoin="miter" />
  </g>`,
  bR: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 9,39 H 36 V 36 H 9 Z" fill="#000000" stroke-linecap="butt" />
    <path d="m 12,36 v -4 h 21 v 4 z" fill="#000000" stroke-linecap="butt" />
    <path d="m 11,14 v 4 h 23 v -4 z" fill="#000000" stroke-linecap="butt" />
    <path d="m 12,18 v 14 h 21 v -14 z" fill="#000000" stroke-linecap="butt" />
    <path d="m 9,9 v 5 h 4.5 v -3 h 4 v 3 h 5 v -3 h 4 v 3 H 36 V 9 Z" fill="#000000" stroke-linecap="butt" />
    <path d="M 12,36 H 33 M 11,14 H 34 M 14,23.5 H 31" stroke="#ececec" stroke-linejoin="miter" />
  </g>`,
  wQ: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 38,14 31,10 31,10 31,10 26,14 22.5,10 19,14 14,10 14,10 14,10 7,14 9,26 Z" fill="#ffffff" stroke-linecap="butt" />
    <path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1.5,2.5 -1.5,2.5 -1.5,1.5 0.5,2.5 0.5,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0.5,-2.5 0,0 0,-1.5 -1.5,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -6,-1.5 -18.5,-1.5 -26.5,0 z" fill="#ffffff" stroke-linecap="butt" />
    <path d="M 11,38.5 A 35,35 1 0 0 34,38.5" fill="none" stroke-linecap="butt" />
    <circle cx="6" cy="12" r="2" fill="#ffffff" />
    <circle cx="14" cy="9" r="2" fill="#ffffff" />
    <circle cx="22.5" cy="8" r="2" fill="#ffffff" />
    <circle cx="31" cy="9" r="2" fill="#ffffff" />
    <circle cx="39" cy="12" r="2" fill="#ffffff" />
  </g>`,
  bQ: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 38,14 31,10 31,10 31,10 26,14 22.5,10 19,14 14,10 14,10 7,14 9,26 Z" fill="#000000" stroke-linecap="butt" />
    <path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1.5,2.5 -1.5,2.5 -1.5,1.5 0.5,2.5 0.5,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0.5,-2.5 0,0 0,-1.5 -1.5,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -6,-1.5 -18.5,-1.5 -26.5,0 z" fill="#000000" stroke-linecap="butt" />
    <circle cx="6" cy="12" r="2" fill="#000000" />
    <circle cx="14" cy="9" r="2" fill="#000000" />
    <circle cx="22.5" cy="8" r="2" fill="#000000" />
    <circle cx="31" cy="9" r="2" fill="#000000" />
    <circle cx="39" cy="12" r="2" fill="#000000" />
    <path d="m 12,33 c 0,0 6,1 10.5,1 4.5,0 10.5,-1 10.5,-1" stroke="#ececec" />
  </g>`,
  wK: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 22.5,11.5 V 6 M 20,8 h 5" stroke-linejoin="miter" />
    <path d="m 22.5,25 c 0,0 4.5,-7.5 3,-10.5 -1.5,-3 -6,-3 -7.5,0 -1.5,3 3,10.5 3,10.5" fill="#ffffff" stroke-linecap="butt" stroke-linejoin="miter" />
    <path d="m 11.5,37 c 5.5,3.5 16.5,3.5 22,0 0,0 0.5,-3 -1,-4.5 -1.5,-1.5 -4.5,-2.5 -4.5,-2.5 -6,2 -9,2 -15,0 0,0 -3,1 -4.5,2.5 -1.5,1.5 -1,4.5 4,4.5 z" fill="#ffffff" />
    <path d="m 11.5,30 c 3.5,-1 18.5,-1 22,0 1.5,1.5 2.5,4 2.5,4 -4.5,2.5 -18.5,2.5 -27,0 0,0 1,-2.5 2.5,-4 z" fill="#ffffff" />
    <path d="m 20,18 h 5 M 22.5,15.5 v 5" stroke-linejoin="miter" />
  </g>`,
  bK: `<g fill="none" fill-rule="evenodd" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 22.5,11.5 V 6 M 20,8 h 5" stroke="#000000" stroke-linejoin="miter" />
    <path d="m 22.5,25 c 0,0 4.5,-7.5 3,-10.5 -1.5,-3 -6,-3 -7.5,0 -1.5,3 3,10.5 3,10.5" fill="#000000" stroke-linecap="butt" stroke-linejoin="miter" />
    <path d="m 11.5,37 c 5.5,3.5 16.5,3.5 22,0 0,0 0.5,-3 -1,-4.5 -1.5,-1.5 -4.5,-2.5 -4.5,-2.5 -6,2 -9,2 -15,0 0,0 -3,1 -4.5,2.5 -1.5,1.5 -1,4.5 4,4.5 z" fill="#000000" />
    <path d="m 11.5,30 c 3.5,-1 18.5,-1 22,0 1.5,1.5 2.5,4 2.5,4 -4.5,2.5 -18.5,2.5 -27,0 0,0 1,-2.5 2.5,-4 z" fill="#000000" />
    <path d="m 20,18 h 5 M 22.5,15.5 v 5" stroke="#ececec" stroke-linejoin="miter" />
  </g>`,
};

/**
 * Returns a complete, standalone SVG document for a given piece.
 */
export function getPieceSvg(piece: PieceType, color: PieceColor): string {
  const symbol = `${color}${piece.toUpperCase()}` as PieceSymbol;
  const body = CLASSIC_PIECE_SVG_BODIES[symbol];
  if (!body) {
    throw new Error(`Unknown chess piece: ${symbol}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">${body}</svg>`;
}

/**
 * All 12 pieces mapped to their complete SVG string.
 */
export const CLASSIC_PIECE_SVGS: Record<PieceSymbol, string> = {
  wP: getPieceSvg("p", "w"),
  wN: getPieceSvg("n", "w"),
  wB: getPieceSvg("b", "w"),
  wR: getPieceSvg("r", "w"),
  wQ: getPieceSvg("q", "w"),
  wK: getPieceSvg("k", "w"),
  bP: getPieceSvg("p", "b"),
  bN: getPieceSvg("n", "b"),
  bB: getPieceSvg("b", "b"),
  bR: getPieceSvg("r", "b"),
  bQ: getPieceSvg("q", "b"),
  bK: getPieceSvg("k", "b"),
};

/**
 * Combined SVG sprite containing all 12 pieces as `<symbol id="...">` elements.
 */
export function getPieceSpriteSvg(): string {
  const symbols = (Object.keys(CLASSIC_PIECE_SVG_BODIES) as PieceSymbol[])
    .map(
      (symbol) =>
        `<symbol id="${symbol}" viewBox="0 0 45 45">${CLASSIC_PIECE_SVG_BODIES[symbol]}</symbol>`,
    )
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n  ${symbols}\n</svg>`;
}
