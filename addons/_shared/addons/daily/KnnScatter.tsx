/**
 * The one hard-coded figure (COMPONENT_SPEC), selected by payload.diagram.kind === 'knn-scatter'.
 * Corrected per the v2 design review: a CONCENTRIC ring around the query point enclosing EXACTLY five
 * nearest neighbours, split 3–2 so the majority (class A) is unambiguous. The payload never carries
 * geometry — points and the ring are fixed here; the payload supplies only the legend labels.
 *
 * Tokens only, and gold (--mastery) is reserved for the quiz result (REVIEW.md #5), so the two classes
 * are `--primary` (circles) and `--accent` (squares) — distinguished by shape as well as hue so it is
 * legible in every theme and colour-blind safe. role="img" + aria-label so it is announced.
 */
import React from 'react';
import { LEARNING_TOKENS as TK } from '@/components/learning/tokens';

const QUERY: [number, number] = [50, 50];
const RING = 17; // radius that encloses the five nearest and excludes the rest

// The five inside the ring: 3 class A + 2 class B → 3–2 majority for A.
const INSIDE_A: [number, number][] = [[42, 44], [58, 43], [46, 63]];
const INSIDE_B: [number, number][] = [[61, 58], [37, 58]];
// The rest, all comfortably outside the ring.
const OUTSIDE_A: [number, number][] = [[22, 26], [80, 22], [24, 78]];
const OUTSIDE_B: [number, number][] = [[82, 76], [74, 84], [20, 80]];

const Circle = ({ p, fill }: { p: [number, number]; fill: string }) => (
  <circle cx={p[0]} cy={p[1]} r="2.6" fill={fill} />
);
const Square = ({ p, fill }: { p: [number, number]; fill: string }) => (
  <rect x={p[0] - 2.3} y={p[1] - 2.3} width="4.6" height="4.6" rx="0.6" fill={fill} />
);

export function KnnScatter({ legend }: { legend?: string[] }) {
  const labelA = legend?.[0] ?? 'Class A';
  const labelB = legend?.[1] ?? 'Class B';
  const labelQ = legend?.[2] ?? 'new point, k=5';

  return (
    <figure className="rounded-xl border border-border bg-background p-3">
      <svg
        viewBox="0 0 100 100"
        className="h-48 w-full"
        role="img"
        aria-label={`k-nearest-neighbours: a new point with a ring around its five nearest neighbours — three ${labelA} and two ${labelB}, so the 3–2 majority vote is ${labelA}.`}
      >
        {/* the k = 5 ring */}
        <circle cx={QUERY[0]} cy={QUERY[1]} r={RING} fill="none" stroke={TK.muted} strokeWidth="0.6" strokeDasharray="2.5 2.5" />
        {/* links to the five inside */}
        {[...INSIDE_A, ...INSIDE_B].map((p, i) => (
          <line key={i} x1={QUERY[0]} y1={QUERY[1]} x2={p[0]} y2={p[1]} stroke={TK.muted} strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        ))}
        {[...INSIDE_A, ...OUTSIDE_A].map((p, i) => <Circle key={`a${i}`} p={p} fill={TK.primary} />)}
        {[...INSIDE_B, ...OUTSIDE_B].map((p, i) => <Square key={`b${i}`} p={p} fill={TK.accent} />)}
        {/* the query point */}
        <circle cx={QUERY[0]} cy={QUERY[1]} r="2.4" fill="none" stroke={TK.text} strokeWidth="1.1" />
        <circle cx={QUERY[0]} cy={QUERY[1]} r="0.9" fill={TK.text} />
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-foreground/75">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: TK.primary }} />{labelA}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[1px]" style={{ background: TK.accent }} />{labelB}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border" style={{ borderColor: TK.text }} />{labelQ}
        </span>
      </figcaption>
    </figure>
  );
}
