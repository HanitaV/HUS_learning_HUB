import { Fragment, memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SubjectCelestialBackdrop } from '../../contracts/subject-module';

export interface ObservatoryCanvasProps {
  readonly backdrop?: SubjectCelestialBackdrop | undefined;
}

const ASTROLABE_DEGREES = [
  { x: 520, y: 74, label: '30°' },
  { x: 740, y: 56, label: '60°' },
  { x: 960, y: 48, label: '90°' },
  { x: 1180, y: 56, label: '120°' },
  { x: 1400, y: 74, label: '150°' },
] as const;

interface OrbitShell {
  readonly id: string;
  readonly size: string;
  readonly tilt: string;
  readonly duration: string;
  readonly direction?: 'normal' | 'reverse';
  readonly electrons: readonly {
    readonly id: string;
    readonly delay: string;
    readonly tone: 'accent' | 'starlight';
  }[];
}

const ORBIT_SHELLS: readonly OrbitShell[] = [
  {
    id: 'outer-shell',
    size: 'min(1320px, 94vw)',
    tilt: '-10deg',
    duration: '24s',
    direction: 'normal',
    electrons: [
      { id: 'outer-a', delay: '-5s', tone: 'accent' },
      { id: 'outer-b', delay: '-17s', tone: 'starlight' },
    ],
  },
  {
    id: 'mid-shell',
    size: 'min(1040px, 82vw)',
    tilt: '12deg',
    duration: '31s',
    direction: 'reverse',
    electrons: [
      { id: 'mid-a', delay: '-2s', tone: 'starlight' },
      { id: 'mid-b', delay: '-17.5s', tone: 'accent' },
    ],
  },
  {
    id: 'inner-shell',
    size: 'min(760px, 66vw)',
    tilt: '-19deg',
    duration: '19s',
    direction: 'normal',
    electrons: [
      { id: 'inner-a', delay: '-1.5s', tone: 'accent' },
      { id: 'inner-b', delay: '-11s', tone: 'starlight' },
    ],
  },
];

interface SkyStar {
  readonly id: string;
  readonly left: string;
  readonly top: string;
  readonly duration: string;
  readonly delay: string;
  readonly direction: 'normal' | 'reverse';
  readonly tone: 'accent' | 'starlight';
}

const SKY_STARS: readonly SkyStar[] = [
  { id: 'star-1', left: '8%', top: '7%', duration: '10.5s', delay: '-1.4s', direction: 'normal', tone: 'starlight' },
  { id: 'star-2', left: '21%', top: '19%', duration: '12.4s', delay: '-4.8s', direction: 'reverse', tone: 'accent' },
  { id: 'star-3', left: '33%', top: '5%', duration: '9.6s', delay: '-2.7s', direction: 'normal', tone: 'starlight' },
  { id: 'star-4', left: '46%', top: '14%', duration: '11.8s', delay: '-6.2s', direction: 'reverse', tone: 'accent' },
  { id: 'star-5', left: '58%', top: '23%', duration: '10.2s', delay: '-3.5s', direction: 'normal', tone: 'starlight' },
  { id: 'star-6', left: '71%', top: '6%', duration: '12.8s', delay: '-8.1s', direction: 'reverse', tone: 'accent' },
  { id: 'star-7', left: '82%', top: '17%', duration: '9.4s', delay: '-5.1s', direction: 'normal', tone: 'starlight' },
  { id: 'star-8', left: '91%', top: '10%', duration: '11.2s', delay: '-0.9s', direction: 'reverse', tone: 'accent' },
];

const SHOOTING_STARS = [
  { id: 'meteor-left', left: '12%', top: '6%', delay: '-1s' },
  { id: 'meteor-center', left: '44%', top: '12%', delay: '-4.7s' },
  { id: 'meteor-right', left: '70%', top: '18%', delay: '-8.3s' },
] as const;

/**
 * Full-bleed edge-to-edge atomic electron & celestial orbital field for the Atmospheric Observatory hero.
 * Static vector SVG tracks (0% SVG re-rasterization) paired with tiny pure-HTML GPU-composited
 * orbiting electrons, upper-sky drifting stars, and shooting stars, auto-paused offscreen or when hidden.
 */
export const ObservatoryCanvas = memo(function ObservatoryCanvas({
  backdrop,
}: ObservatoryCanvasProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let inView = true;
    let tabHidden = document.visibilityState === 'hidden';

    const syncPaused = () => {
      setPaused(!inView || tabHidden);
    };

    syncPaused();

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (entry) {
                inView = entry.isIntersecting;
                syncPaused();
              }
            },
            { threshold: 0.02 },
          )
        : null;

    observer?.observe(node);

    const handleVisibilityChange = () => {
      tabHidden = document.visibilityState === 'hidden';
      syncPaused();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const backdropStyle: CSSProperties | undefined = backdrop
    ? ({
        '--hus-backdrop-light-core': backdrop.lightGlowCore,
        '--hus-backdrop-light-warm': backdrop.lightGlowWarm,
        '--hus-backdrop-dark-core': backdrop.darkGlowCore,
        '--hus-backdrop-dark-warm': backdrop.darkGlowWarm,
      } as CSSProperties)
    : undefined;

  const hasSubjectConstellations = Boolean(backdrop && backdrop.constellations.length > 0);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-sky-paused={paused ? 'true' : 'false'}
      data-has-subject-backdrop={backdrop ? 'true' : 'false'}
      style={backdropStyle}
      className="hus-observatory-root pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      <svg
        viewBox="0 0 1920 880"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <defs>
          <radialGradient id="hus-zenith-halo" cx="50%" cy="48%" r="50%">
            <stop offset="0%" stopColor="var(--hus-active-core)" className="hus-observatory-stop" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="hus-starlight-left" cx="14%" cy="32%" r="28%">
            <stop offset="0%" stopColor="var(--hus-active-warm)" className="hus-observatory-stop" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="hus-starlight-right" cx="86%" cy="28%" r="28%">
            <stop offset="0%" stopColor="var(--hus-active-warm)" className="hus-observatory-stop" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Full-bleed atmospheric diffusion reaching both viewport edges */}
        <rect width="1920" height="880" fill="url(#hus-zenith-halo)" />
        <rect width="1920" height="880" fill="url(#hus-starlight-left)" />
        <rect width="1920" height="880" fill="url(#hus-starlight-right)" />

        {/* Observatory Astrolabe Degree Dial Arc */}
        <g data-astrolabe-dial="true">
          <path d="M 380 88 Q 960 14 1540 88" stroke="var(--hus-orbit)" strokeWidth="1" />
          <path
            d="M 430 96 Q 960 26 1490 96"
            stroke="var(--hus-orbit-strong)"
            strokeWidth="1"
            strokeDasharray="1 16"
          />
          {ASTROLABE_DEGREES.map((mark) => (
            <Fragment key={mark.label}>
              <line
                x1={mark.x}
                y1={mark.y + 4}
                x2={mark.x}
                y2={mark.y + 9}
                stroke="var(--hus-orbit-strong)"
                strokeWidth="1"
              />
              <text
                x={mark.x}
                y={mark.y}
                fontFamily="var(--font-mono)"
                fontSize="10"
                fill="var(--hus-ink-muted)"
                fillOpacity="0.48"
                textAnchor="middle"
              >
                {mark.label}
              </text>
            </Fragment>
          ))}
        </g>

        {/* Full-width horizon & meridian coordinate hairlines */}
        <line
          x1="960"
          y1="24"
          x2="960"
          y2="856"
          stroke="var(--hus-orbit)"
          strokeWidth="1"
          strokeDasharray="4 9"
        />
        <line
          x1="0"
          y1="470"
          x2="1920"
          y2="470"
          stroke="var(--hus-orbit)"
          strokeWidth="1"
          strokeDasharray="4 9"
        />

        {/* Wide outer atomic shell sweeping edge-to-edge across left & right flanks */}
        <g transform="rotate(-9 960 470)">
          <ellipse
            cx="960"
            cy="470"
            rx="940"
            ry="310"
            stroke="var(--hus-orbit-strong)"
            strokeWidth="1.25"
          />
          <circle cx="52" cy="390" r="13" fill="var(--hus-accent)" fillOpacity="0.14" />
          <circle cx="52" cy="390" r="5.5" fill="var(--hus-accent)" />
          <circle cx="1868" cy="550" r="14" fill="var(--hus-starlight)" fillOpacity="0.18" />
          <circle cx="1868" cy="550" r="5.5" fill="var(--hus-starlight)" />
        </g>

        {/* Counter-inclined wide electron shell */}
        <g transform="rotate(11 960 470)">
          <ellipse
            cx="960"
            cy="470"
            rx="860"
            ry="265"
            stroke="var(--hus-orbit)"
            strokeWidth="1.15"
            strokeDasharray="7 8"
          />
          <circle cx="136" cy="394" r="11" fill="var(--hus-starlight)" fillOpacity="0.18" />
          <circle cx="136" cy="394" r="4.8" fill="var(--hus-starlight)" />
          <circle cx="1784" cy="546" r="12" fill="var(--hus-accent)" fillOpacity="0.15" />
          <circle cx="1784" cy="546" r="5" fill="var(--hus-accent)" />
        </g>

        {/* Mid-shell harmonic atomic ellipse */}
        <g transform="rotate(-18 960 470)">
          <ellipse
            cx="960"
            cy="470"
            rx="650"
            ry="235"
            stroke="var(--hus-orbit-strong)"
            strokeWidth="1.15"
          />
          <circle cx="316" cy="442" r="11" fill="var(--hus-accent)" fillOpacity="0.16" />
          <circle cx="316" cy="442" r="4.6" fill="var(--hus-accent)" />
          <circle cx="1604" cy="498" r="11" fill="var(--hus-starlight)" fillOpacity="0.2" />
          <circle cx="1604" cy="498" r="4.6" fill="var(--hus-starlight)" />
        </g>

        {/* Inner quantum ring framing the central search nucleus */}
        <g transform="rotate(20 960 470)">
          <ellipse
            cx="960"
            cy="470"
            rx="460"
            ry="180"
            stroke="var(--hus-orbit)"
            strokeWidth="1.1"
            strokeDasharray="3 7"
          />
          <circle cx="502" cy="452" r="9" fill="var(--hus-starlight)" fillOpacity="0.18" />
          <circle cx="502" cy="452" r="3.8" fill="var(--hus-starlight)" />
          <circle cx="1418" cy="488" r="9" fill="var(--hus-accent)" fillOpacity="0.16" />
          <circle cx="1418" cy="488" r="3.8" fill="var(--hus-accent)" />
        </g>

        {/* Subject-reactive scientific constellations or crisp default flanking lines */}
        {hasSubjectConstellations && backdrop ? (
          <g
            key={backdrop.constellations.map((c) => c.id).join(':')}
            className="hus-constellation-fade"
            data-subject-constellation="true"
          >
            {backdrop.constellations.map((figure) => (
              <Fragment key={figure.id}>
                {figure.paths.map((d, index) => (
                  <Fragment key={`${figure.id}-path-${index}`}>
                    <path
                      d={d}
                      stroke="var(--hus-accent)"
                      strokeOpacity="0.16"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={d}
                      stroke="var(--hus-orbit-strong)"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Fragment>
                ))}
                {figure.stars.map((star, index) => {
                  const radius = star.r ?? 3.2;
                  const fill =
                    star.tone === 'starlight' ? 'var(--hus-starlight)' : 'var(--hus-accent)';
                  return (
                    <Fragment key={`${figure.id}-star-${index}`}>
                      <circle cx={star.cx} cy={star.cy} r={radius * 2.6} fill={fill} fillOpacity="0.18" />
                      <circle cx={star.cx} cy={star.cy} r={radius} fill={fill} />
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </g>
        ) : (
          <g>
            <circle cx="198" cy="176" r="3.2" fill="var(--hus-starlight)" fillOpacity="0.85" />
            <circle cx="284" cy="132" r="2.4" fill="var(--hus-accent)" fillOpacity="0.7" />
            <circle cx="1722" cy="168" r="3.4" fill="var(--hus-starlight)" fillOpacity="0.85" />
            <circle cx="1632" cy="124" r="2.4" fill="var(--hus-accent)" fillOpacity="0.7" />
            <path
              d="M198 176L284 132M1632 124L1722 168"
              stroke="var(--hus-orbit-strong)"
              strokeWidth="1"
            />
          </g>
        )}
      </svg>

      {/* Far parallax layer: upper-sky drifting stars & shooting stars */}
      <div className="hus-parallax-far absolute inset-0 pointer-events-none">
        {SKY_STARS.map((star) => (
          <span
            key={star.id}
            className="hus-sky-star"
            style={
              {
                left: star.left,
                top: star.top,
                color: star.tone === 'starlight' ? 'var(--hus-starlight)' : 'var(--hus-accent)',
                '--star-dur': star.duration,
                animationDelay: star.delay,
                animationDirection: star.direction,
              } as CSSProperties
            }
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M6 0.5L7.35 4.65L11.5 6L7.35 7.35L6 11.5L4.65 7.35L0.5 6L4.65 4.65Z" />
            </svg>
          </span>
        ))}

        {SHOOTING_STARS.map((meteor) => (
          <span
            key={meteor.id}
            className="hus-shooting-star"
            style={{
              left: meteor.left,
              top: meteor.top,
              animationDelay: meteor.delay,
            }}
          />
        ))}
      </div>

      {/* Near parallax layer: 6 GPU-composited orbiting electrons + flank orbs */}
      <div className="hus-parallax-near absolute inset-0 pointer-events-none">
        {ORBIT_SHELLS.map((shell) => (
          <div
            key={shell.id}
            className="hus-electron-ring"
            style={
              {
                '--orbit-size': shell.size,
                '--orbit-tilt': shell.tilt,
                '--orbit-dur': shell.duration,
              } as CSSProperties
            }
          >
            {shell.electrons.map((electron) => (
              <div
                key={electron.id}
                className="hus-electron-rotor"
                style={{
                  animationDelay: electron.delay,
                  animationDirection: shell.direction ?? 'normal',
                }}
              >
                <div className="hus-electron-carrier">
                  <span
                    className={
                      electron.tone === 'accent'
                        ? 'hus-electron-orb hus-electron-orb-accent'
                        : 'hus-electron-orb hus-electron-orb-starlight'
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Lightweight GPU-composited floating electron orbs along both outer flanks (tiny 10px HTML layers, zero SVG repaint) */}
        <span
          style={{ left: '4%', top: '38%' }}
          className="hus-float-node-0 hidden h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15 md:block md:absolute"
        />
        <span
          style={{ left: '8%', top: '64%', animationDelay: '-2.1s' }}
          className="hus-float-node-1 hidden h-2.5 w-2.5 rounded-full bg-starlight ring-4 ring-starlight/20 md:block md:absolute"
        />
        <span
          style={{ right: '4%', top: '42%', animationDelay: '-1.3s' }}
          className="hus-float-node-2 hidden h-2.5 w-2.5 rounded-full bg-starlight ring-4 ring-starlight/20 md:block md:absolute"
        />
        <span
          style={{ right: '8.5%', top: '68%', animationDelay: '-3.4s' }}
          className="hus-float-node-0 hidden h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15 md:block md:absolute"
        />
      </div>
    </div>
  );
});
