/** Pure numeric helpers for CHE1080 visual explanations. SI units unless stated. */
export const H_PLANCK = 6.62607015e-34;
export const C_LIGHT = 2.99792458e8;
export const EV_J = 1.602176634e-19;
export const R_GAS = 8.314462618;
export const FARADAY = 96485.33212;
/** Rydberg energy of hydrogen in eV (13.605693...). */
export const RYDBERG_EV = 13.605693123;

/** E_n = -Z² · 13.6057 / n² (eV). */
export function hydrogenLevelEv(n: number, z = 1): number {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  return (-RYDBERG_EV * z * z) / (n * n);
}

export interface Transition {
  readonly deltaEv: number;
  readonly kind: 'emission' | 'absorption' | 'none';
  readonly wavelengthNm: number | null;
}

export function hydrogenTransition(nFrom: number, nTo: number, z = 1): Transition {
  const deltaEv = hydrogenLevelEv(nTo, z) - hydrogenLevelEv(nFrom, z);
  if (deltaEv === 0) return { deltaEv: 0, kind: 'none', wavelengthNm: null };
  const joules = Math.abs(deltaEv) * EV_J;
  return {
    deltaEv,
    kind: deltaEv < 0 ? 'emission' : 'absorption',
    wavelengthNm: ((H_PLANCK * C_LIGHT) / joules) * 1e9,
  };
}

export function firstOrderConcentration(c0: number, k: number, t: number): number {
  return c0 * Math.exp(-k * t);
}
export function halfLifeFromK(k: number): number {
  if (k <= 0) throw new RangeError('k must be positive');
  return Math.LN2 / k;
}
export function kFromHalfLife(tHalf: number): number {
  if (tHalf <= 0) throw new RangeError('half-life must be positive');
  return Math.LN2 / tHalf;
}

/** k2 = k1 · exp(-Ea/R · (1/T2 - 1/T1)); Ea in J/mol. */
export function arrheniusK2(k1: number, t1: number, t2: number, eaJ: number): number {
  return k1 * Math.exp((-eaJ / R_GAS) * (1 / t2 - 1 / t1));
}
/** Ea (J/mol) from two rate constants. */
export function activationEnergy(k1: number, t1: number, k2: number, t2: number): number {
  if (t1 === t2) throw new RangeError('temperatures must differ');
  return (R_GAS * Math.log(k2 / k1)) / (1 / t1 - 1 / t2);
}

/** Exact pH of a weak monoprotic acid (HA ⇌ H⁺ + A⁻), ignoring water autoionization. */
export function weakAcidPh(ka: number, c: number): number {
  if (ka <= 0 || c <= 0) throw new RangeError('Ka and C must be positive');
  const x = (-ka + Math.sqrt(ka * ka + 4 * ka * c)) / 2;
  return -Math.log10(x);
}
/** Weak base via Kb, Kw = 1e-14. */
export function weakBasePh(kb: number, c: number, kw = 1e-14): number {
  if (kb <= 0 || c <= 0) throw new RangeError('Kb and C must be positive');
  const x = (-kb + Math.sqrt(kb * kb + 4 * kb * c)) / 2;
  return -Math.log10(kw) + Math.log10(x);
}
export function hendersonPh(pKa: number, base: number, acid: number): number {
  if (base <= 0 || acid <= 0) throw new RangeError('concentrations must be positive');
  return pKa + Math.log10(base / acid);
}

/** E = E° − (RT/nF)·ln Q (V). */
export function nernst(e0: number, n: number, q: number, tK = 298.15): number {
  if (n <= 0 || q <= 0) throw new RangeError('n and Q must be positive');
  return e0 - ((R_GAS * tK) / (n * FARADAY)) * Math.log(q);
}
/** ΔG° = −nFE° (J/mol). */
export function gibbsFromCell(e0: number, n: number): number {
  return -n * FARADAY * e0;
}
