"use client";

import { useEffect, useMemo, useRef } from "react";

type TextSegment = {
  type: "text";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  radius: number;
  gap: number;
};

type RuleSegment = {
  type: "rule";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Segment = TextSegment | RuleSegment;

const SEGMENT_SPECS: Segment[] = [
  { type: "text", x1: 98, y1: 76, x2: 205, y2: 76, radius: 4.4, gap: 13 },
  { type: "text", x1: 98, y1: 106, x2: 232, y2: 106, radius: 3.1, gap: 9 },
  { type: "text", x1: 98, y1: 126, x2: 232, y2: 126, radius: 3.1, gap: 9 },
  { type: "text", x1: 98, y1: 146, x2: 188, y2: 146, radius: 3.1, gap: 9 },
  { type: "text", x1: 98, y1: 176, x2: 232, y2: 176, radius: 3.1, gap: 9 },
  { type: "text", x1: 98, y1: 196, x2: 232, y2: 196, radius: 3.1, gap: 9 },
  { type: "text", x1: 98, y1: 216, x2: 152, y2: 216, radius: 3.1, gap: 9 },
  { type: "rule", x1: 98, y1: 272, x2: 232, y2: 272 },
  { type: "text", x1: 98, y1: 288, x2: 146, y2: 288, radius: 2.6, gap: 8 },
  { type: "text", x1: 184, y1: 288, x2: 220, y2: 288, radius: 2.6, gap: 8 },
];

function getLength(segment: Segment) {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
}

function getDots(segment: TextSegment) {
  const count = Math.max(1, Math.floor(getLength(segment) / segment.gap));
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0 : index / (count - 1);
    return {
      x: segment.x1 + (segment.x2 - segment.x1) * progress,
      y: segment.y1 + (segment.y2 - segment.y1) * progress,
    };
  });
}

export default function ContractLoader() {
  const dotRefs = useRef<(SVGCircleElement | null)[][]>([]);
  const ruleRef = useRef<SVGLineElement>(null);
  const caretRef = useRef<SVGRectElement>(null);
  const segments = useMemo(
    () => SEGMENT_SPECS.map(segment => (segment.type === "text" ? { ...segment, dots: getDots(segment) } : segment)),
    []
  );

  useEffect(() => {
    const TYPE_MS = 2800;
    const PAUSE_MS = 1000;
    const ERASE_MS = 1700;
    const cycleMs = TYPE_MS + PAUSE_MS + ERASE_MS;
    const totalLength = segments.reduce((sum, segment) => sum + getLength(segment), 0);
    const typeStarts: number[] = [];
    const eraseStarts: number[] = [];
    let accumulated = 0;

    segments.forEach(segment => {
      typeStarts.push(accumulated);
      accumulated += (getLength(segment) / totalLength) * TYPE_MS;
    });

    accumulated = 0;
    [...segments].reverse().forEach(segment => {
      eraseStarts[segments.indexOf(segment)] = accumulated;
      accumulated += (getLength(segment) / totalLength) * ERASE_MS;
    });

    const applyFraction = (segmentIndex: number, fraction: number) => {
      const segment = segments[segmentIndex];
      if (segment.type === "rule") {
        ruleRef.current?.style.setProperty("stroke-dasharray", `${fraction} ${Math.max(0, 1 - fraction)}`);
        return;
      }

      const visibleDots = Math.round(fraction * segment.dots.length);
      dotRefs.current[segmentIndex]?.forEach((dot, dotIndex) => {
        if (dot) dot.style.opacity = dotIndex < visibleDots ? "1" : "0";
      });
    };

    const getCaretPosition = (segmentIndex: number, fraction: number) => {
      const segment = segments[segmentIndex];
      if (segment.type === "rule") {
        return { x: segment.x1 + (segment.x2 - segment.x1) * fraction, y: segment.y1 - 8 };
      }

      const dotIndex = Math.min(segment.dots.length - 1, Math.max(0, Math.round(fraction * segment.dots.length)));
      const dot = segment.dots[dotIndex] || segment.dots[segment.dots.length - 1];
      return { x: dot.x, y: dot.y - segment.radius - 7 };
    };

    const startedAt = performance.now();
    let animationFrame = 0;

    const animate = (now: number) => {
      const elapsed = (now - startedAt) % cycleMs;
      let activeCaret: { x: number; y: number } | null = null;

      if (elapsed < TYPE_MS) {
        segments.forEach((segment, index) => {
          const duration = (getLength(segment) / totalLength) * TYPE_MS;
          const localTime = elapsed - typeStarts[index];
          const fraction = localTime <= 0 ? 0 : localTime >= duration ? 1 : localTime / duration;
          applyFraction(index, fraction);
          if (localTime > 0 && localTime < duration) activeCaret = getCaretPosition(index, fraction);
        });
      } else if (elapsed < TYPE_MS + PAUSE_MS) {
        segments.forEach((_, index) => applyFraction(index, 1));
      } else {
        const eraseTime = elapsed - TYPE_MS - PAUSE_MS;
        segments.forEach((segment, index) => {
          const duration = (getLength(segment) / totalLength) * ERASE_MS;
          const localTime = eraseTime - eraseStarts[index];
          const erasedFraction = localTime <= 0 ? 0 : localTime >= duration ? 1 : localTime / duration;
          const fraction = 1 - erasedFraction;
          applyFraction(index, fraction);
          if (localTime > 0 && localTime < duration) activeCaret = getCaretPosition(index, fraction);
        });
      }

      const caretPosition = activeCaret as { x: number; y: number } | null;
      if (caretRef.current) {
        caretRef.current.style.display = caretPosition ? "block" : "none";
        caretRef.current.style.opacity = caretPosition ? "1" : "0";
        if (caretPosition) caretRef.current.style.transform = `translate(${caretPosition.x - 1.5}px, ${caretPosition.y}px)`;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    segments.forEach((_, index) => applyFraction(index, 0));
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [segments]);

  return (
    <main className="contract-loader" aria-label="Loading contract workspace">
      <div className="contract-loader__stage">
        <svg viewBox="0 0 400 400" role="img" aria-hidden="true">
          <defs>
            <radialGradient id="contract-loader-gradient" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="var(--loader-backdrop-bright)" />
              <stop offset="100%" stopColor="var(--loader-backdrop)" />
            </radialGradient>
          </defs>
          <circle cx="210" cy="200" r="168" fill="url(#contract-loader-gradient)" />
          <g>
            <path d="M75,40 H255 a14,14 0 0 1 14,14 V330 a10,10 0 0 1 -10,10 H85 a10,10 0 0 1 -10,-10 V54 a14,14 0 0 1 14,-14 Z M75,40 a14,14 0 0 0 -14,14 V60 l14,-8 l14,8 V54 a14,14 0 0 0 -14,-14 Z" fill="var(--loader-paper)" stroke="var(--loader-paper-edge)" strokeWidth="2" />
            {segments.map((segment, segmentIndex) => {
              if (segment.type === "rule") return null;
              return (
                <g key={`${segment.x1}-${segment.y1}`}>
                  {segment.dots.map((dot, dotIndex) => (
                    <circle
                      key={dotIndex}
                      ref={element => {
                        if (!dotRefs.current[segmentIndex]) dotRefs.current[segmentIndex] = [];
                        dotRefs.current[segmentIndex][dotIndex] = element;
                      }}
                      cx={dot.x}
                      cy={dot.y}
                      r={segment.radius}
                      fill={segmentIndex === 0 || segmentIndex > 7 ? "var(--loader-ink-dark)" : "var(--loader-ink-mid)"}
                      opacity="0"
                    />
                  ))}
                </g>
              );
            })}
            <line ref={ruleRef} x1="98" y1="272" x2="232" y2="272" stroke="var(--loader-rule)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0 1" pathLength="1" />
            <rect ref={caretRef} x="0" y="0" width="3" height="12" rx="1.5" fill="var(--loader-ink-dark)" opacity="0" />
          </g>
        </svg>
      </div>
      <p className="contract-loader__label">Drafting your contract<span aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p>
    </main>
  );
}
