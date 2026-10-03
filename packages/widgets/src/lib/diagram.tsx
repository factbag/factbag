import type { JSX, ReactNode } from "react";

/**
 * Standard diagram surface: a fixed-size px-coordinate canvas that scrolls
 * horizontally on small screens, with an SVG edge layer underneath
 * absolutely-positioned HTML nodes.
 */
export function DiagramCanvas(props: {
  readonly children: ReactNode;
  readonly height: number;
  readonly svg: ReactNode;
  readonly width: number;
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto" style={{ height: props.height, width: props.width }}>
        <svg
          aria-hidden="true"
          className="absolute inset-0"
          height={props.height}
          viewBox={`0 0 ${props.width} ${props.height}`}
          width={props.width}
        >
          {props.svg}
        </svg>
        {props.children}
      </div>
    </div>
  );
}

/** Vertical S-curve between two points, bending at the midpoint — the house tree-edge shape. */
export function treeCurve(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;

  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

/**
 * An edge that carries the marching-dash animation while active and fades to
 * a quiet stroke while idle. Colors are any CSS color, `var(…)` included.
 */
export function FlowEdge(props: {
  readonly active: boolean;
  readonly activeWidth?: number;
  readonly color: string;
  readonly d: string;
  readonly dashedWhenIdle?: boolean;
  readonly idleColor?: string;
  readonly idleOpacity?: number;
  readonly idleWidth?: number;
  readonly markerEnd?: string;
}): JSX.Element {
  return (
    <path
      className={props.active ? "edge-flow" : undefined}
      d={props.d}
      fill="none"
      markerEnd={props.markerEnd}
      opacity={props.active ? 1 : (props.idleOpacity ?? 0.2)}
      stroke={props.active ? props.color : (props.idleColor ?? props.color)}
      strokeDasharray={props.dashedWhenIdle === true && !props.active ? "4 5" : undefined}
      strokeLinecap="round"
      strokeWidth={props.active ? (props.activeWidth ?? 4) : (props.idleWidth ?? 2)}
      style={{ transition: "opacity 0.3s, stroke 0.3s" }}
    />
  );
}
