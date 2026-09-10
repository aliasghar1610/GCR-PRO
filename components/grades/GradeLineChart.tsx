"use client";

import { useState } from "react";
import { courseColorVars } from "@/lib/courseColor";
import type { CourseGradeSeries } from "@/lib/gradeSeries";

const WIDTH = 720;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 32, left: 36 };
const TICKS = [0, 25, 50, 75, 100];

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function GradeLineChart({ series }: { series: CourseGradeSeries[] }) {
  const [hover, setHover] = useState<{ seriesIdx: number; pointIdx: number } | null>(null);

  const plottable = series.filter((s) => s.points.length > 0);
  if (plottable.length === 0) return null;

  const allX = plottable.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  const xSpan = Math.max(xMax - xMin, 1);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const xPos = (x: number) => PAD.left + ((x - xMin) / xSpan) * plotW;
  const yPos = (y: number) => PAD.top + (1 - y / 100) * plotH;

  const xTicks =
    xMin === xMax ? [xMin] : [xMin, xMin + xSpan * 0.5, xMax].map((v) => Math.round(v));

  const hovered =
    hover != null ? plottable[hover.seriesIdx]?.points[hover.pointIdx] : null;
  const hoveredSeries = hover != null ? plottable[hover.seriesIdx] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Grade percentage over time by course">
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yPos(t)}
                y2={yPos(t)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yPos(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-muted text-[10px] tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {xTicks.map((t, i) => (
            <text
              key={i}
              x={xPos(t)}
              y={HEIGHT - PAD.bottom + 18}
              textAnchor="middle"
              className="fill-text-muted text-[10px] tabular-nums"
            >
              {fmtDate(t)}
            </text>
          ))}

          {plottable.map((s, si) => {
            const color = courseColorVars(s.courseId).solid;
            const path = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${xPos(p.x)},${yPos(p.y)}`).join(" ");
            return (
              <g key={s.courseId}>
                <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                {s.points.map((p, pi) => (
                  <g key={pi}>
                    <circle cx={xPos(p.x)} cy={yPos(p.y)} r={6} className="fill-bg-card" />
                    <circle
                      cx={xPos(p.x)}
                      cy={yPos(p.y)}
                      r={4}
                      fill={color}
                      className="cursor-pointer"
                      onMouseEnter={() => setHover({ seriesIdx: si, pointIdx: pi })}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>

        {hovered && hoveredSeries && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-bg-sidebar text-text-inverse text-xs px-2.5 py-1.5 shadow-pop whitespace-nowrap"
            style={{
              left: `${(xPos(hovered.x) / WIDTH) * 100}%`,
              top: `${(yPos(hovered.y) / HEIGHT) * 100 - 2}%`,
            }}
          >
            <p className="font-medium">{hoveredSeries.courseName}</p>
            <p className="text-text-sidebar">
              {hovered.title} · {hovered.y}% · {fmtDate(hovered.x)}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {plottable.map((s) => (
          <span key={s.courseId} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: courseColorVars(s.courseId).solid }}
            />
            {s.courseName}
          </span>
        ))}
      </div>
    </div>
  );
}
