export type ReactionShift = 'forward' | 'reverse' | 'equilibrium';

export interface GalvanicCellResult {
  readonly eStandard: number;
  readonly eNernst: number;
  readonly deltaGStandardKj: number;
  readonly spontaneous: boolean;
}

const GAS_CONSTANT_J_PER_MOL_K = 8.314462618;
const FARADAY_CONSTANT_C_PER_MOL = 96485.33212;
const DEFAULT_TEMP_K = 298.15;
const EQUILIBRIUM_REL_TOLERANCE = 1e-6;

/**
 * Compares reaction quotient Q against equilibrium constant K
 * to determine the spontaneous shift direction.
 */
export function evaluateReactionShift(q: number, k: number): ReactionShift {
  if (!Number.isFinite(q) || q < 0) {
    throw new RangeError('Reaction quotient Q must be a finite non-negative number.');
  }
  if (!Number.isFinite(k) || k <= 0) {
    throw new RangeError('Equilibrium constant K must be a finite positive number.');
  }

  if (q === k || Math.abs(q - k) <= EQUILIBRIUM_REL_TOLERANCE * k) {
    return 'equilibrium';
  }
  return q < k ? 'forward' : 'reverse';
}

/**
 * Computes buffer pH using the Henderson-Hasselbalch equation:
 * pH = pKa + log10([Base] / [Acid]).
 */
export function computeBufferPh(pKa: number, acidConc: number, baseConc: number): number {
  if (!Number.isFinite(pKa)) {
    throw new RangeError('pKa must be a finite number.');
  }
  if (!Number.isFinite(acidConc) || acidConc <= 0) {
    throw new RangeError('Acid concentration must be a finite positive number.');
  }
  if (!Number.isFinite(baseConc) || baseConc <= 0) {
    throw new RangeError('Base concentration must be a finite positive number.');
  }

  return pKa + Math.log10(baseConc / acidConc);
}

/**
 * Computes standard cell potential, Nernst potential E(Q), standard Gibbs free energy (kJ/mol),
 * and spontaneity for a galvanic cell at temperature T (default 298.15 K).
 */
export function computeGalvanicCell(
  eCathode: number,
  eAnode: number,
  n: number,
  q: number,
  tempK: number = DEFAULT_TEMP_K,
): GalvanicCellResult {
  if (!Number.isFinite(eCathode) || !Number.isFinite(eAnode)) {
    throw new RangeError('Electrode potentials must be finite numbers.');
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError('Number of transferred electrons n must be a positive integer.');
  }
  if (!Number.isFinite(q) || q <= 0) {
    throw new RangeError('Reaction quotient Q must be a finite positive number.');
  }
  if (!Number.isFinite(tempK) || tempK <= 0) {
    throw new RangeError('Temperature T must be a finite positive number in Kelvin.');
  }

  const eStandard = eCathode - eAnode;
  const nernstFactor = (GAS_CONSTANT_J_PER_MOL_K * tempK) / (n * FARADAY_CONSTANT_C_PER_MOL);
  const eNernst = eStandard - nernstFactor * Math.log(q);
  const deltaGStandardKj = (-n * FARADAY_CONSTANT_C_PER_MOL * eStandard) / 1000;

  return {
    eStandard,
    eNernst,
    deltaGStandardKj,
    spontaneous: eNernst > 0,
  };
}
