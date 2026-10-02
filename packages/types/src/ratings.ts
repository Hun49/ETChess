export interface Glicko2Rating {
  rating: number;
  deviation: number;
  volatility: number;
}

export const GLICKO2_DEFAULTS: Glicko2Rating = {
  rating: 1500,
  deviation: 350,
  volatility: 0.06,
};
