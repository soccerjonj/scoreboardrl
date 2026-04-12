// Car silhouette SVG components for the profile favorite car picker.
// ViewBox: 0 0 120 58
// Wheel cy: 48, radius: 9  — front wheel cx: 27, rear wheel cx: 93 (defaults, vary per car)

export type CarOption = {
  name: string;
  color: string;       // accent hex
  bodyPath: string;    // SVG path for body silhouette
  frontX: number;      // front wheel cx
  rearX: number;       // rear wheel cx
};

export const CARS: CarOption[] = [
  {
    name: "Octane",
    color: "#3b82f6",
    // Classic balanced boxy shape — the go-to RL car
    bodyPath: "M 6,40 L 8,30 L 16,20 L 28,14 L 88,14 L 96,20 L 106,30 L 108,40 Z",
    frontX: 27, rearX: 93,
  },
  {
    name: "Fennec",
    color: "#8b5cf6",
    // More square/upright than Octane, almost equal front-rear slopes
    bodyPath: "M 8,40 L 10,28 L 18,16 L 28,11 L 88,11 L 98,16 L 106,28 L 108,40 Z",
    frontX: 27, rearX: 93,
  },
  {
    name: "Dominus",
    color: "#f97316",
    // Long, flat, almost no cabin dome — the premium flat car
    bodyPath: "M 4,40 L 6,36 L 12,28 L 20,24 L 30,21 L 90,21 L 100,24 L 108,28 L 114,36 L 114,40 Z",
    frontX: 25, rearX: 96,
  },
  {
    name: "Breakout",
    color: "#ef4444",
    // Aggressive wedge — low front that sweeps up to roof at rear
    bodyPath: "M 4,40 L 4,37 L 10,28 L 18,20 L 28,16 L 88,13 L 98,16 L 108,24 L 112,34 L 112,40 Z",
    frontX: 24, rearX: 94,
  },
  {
    name: "Merc",
    color: "#6b7280",
    // Tall, boxy, SUV-like proportions
    bodyPath: "M 8,40 L 8,22 L 14,12 L 26,6 L 90,6 L 100,12 L 106,22 L 106,40 Z",
    frontX: 27, rearX: 90,
  },
  {
    name: "Batmobile",
    color: "#1d4ed8",
    // Long + distinctive rear fin spike
    bodyPath: "M 2,40 L 2,36 L 8,26 L 16,20 L 24,16 L 86,14 L 92,10 L 100,5 L 106,10 L 110,18 L 114,28 L 116,38 L 116,40 Z",
    frontX: 22, rearX: 97,
  },
  {
    name: "Mantis",
    color: "#22c55e",
    // Extremely flat — the pancake car
    bodyPath: "M 2,40 L 2,38 L 8,32 L 16,28 L 24,26 L 92,26 L 100,28 L 108,32 L 114,38 L 114,40 Z",
    frontX: 24, rearX: 96,
  },
  {
    name: "Road Hog",
    color: "#f59e0b",
    // Chunky muscle car, higher ride height, beefy
    bodyPath: "M 6,40 L 6,28 L 12,18 L 22,10 L 34,6 L 84,6 L 96,10 L 106,18 L 110,28 L 110,40 Z",
    frontX: 26, rearX: 92,
  },
  {
    name: "Paladin",
    color: "#64748b",
    // Very tall military/jeep proportions — the tallest car
    bodyPath: "M 8,40 L 8,18 L 14,8 L 26,2 L 90,2 L 100,8 L 106,18 L 106,40 Z",
    frontX: 27, rearX: 90,
  },
  {
    name: "Endo",
    color: "#06b6d4",
    // Futuristic, angular, swooping roofline
    bodyPath: "M 6,40 L 6,30 L 12,20 L 20,13 L 30,10 L 88,10 L 98,14 L 108,22 L 112,32 L 112,40 Z",
    frontX: 26, rearX: 94,
  },
  {
    name: "Takumi",
    color: "#ec4899",
    // Compact Japanese sports car — shorter wheelbase
    bodyPath: "M 12,40 L 12,32 L 20,20 L 30,13 L 42,10 L 76,10 L 88,13 L 98,22 L 102,32 L 102,40 Z",
    frontX: 30, rearX: 88,
  },
  {
    name: "Jäger 619",
    color: "#6366f1",
    // Sleek low European sports car
    bodyPath: "M 4,40 L 4,36 L 8,28 L 14,22 L 22,18 L 32,15 L 86,15 L 98,18 L 108,24 L 114,34 L 116,40 Z",
    frontX: 24, rearX: 96,
  },
  {
    name: "Zippy",
    color: "#84cc16",
    // Tiny and cute — small rounded car
    bodyPath: "M 18,40 L 18,30 L 24,18 L 34,12 L 46,8 L 72,8 L 84,12 L 94,18 L 100,30 L 100,40 Z",
    frontX: 32, rearX: 86,
  },
  {
    name: "Nimbus",
    color: "#0ea5e9",
    // Rounded cloud-like SUV shape
    bodyPath: "M 14,40 L 14,24 L 18,12 L 28,6 L 44,4 L 74,4 L 90,6 L 100,12 L 106,24 L 106,40 Z",
    frontX: 28, rearX: 90,
  },
  {
    name: "Twinzer",
    color: "#a855f7",
    // Wide, low, twin-engine look
    bodyPath: "M 4,40 L 4,34 L 10,24 L 18,18 L 28,16 L 34,18 L 40,22 L 78,22 L 84,18 L 90,16 L 100,18 L 108,24 L 114,34 L 114,40 Z",
    frontX: 24, rearX: 96,
  },
];

// ─── CarSilhouette ────────────────────────────────────────────────────────────

export const CarSilhouette = ({
  car,
  size = 80,
  active = false,
  className = "",
}: {
  car: CarOption;
  size?: number;
  active?: boolean;
  className?: string;
}) => {
  const height = Math.round(size * 58 / 120);
  const wheelR = 9;
  const wheelCy = 48;

  return (
    <svg
      viewBox="0 0 120 58"
      width={size}
      height={height}
      className={className}
      aria-label={car.name}
      style={{ display: "block" }}
    >
      {/* Body */}
      <path
        d={car.bodyPath}
        fill={active ? car.color : "currentColor"}
        opacity={active ? 1 : 0.55}
      />
      {/* Front wheel */}
      <circle cx={car.frontX} cy={wheelCy} r={wheelR}
        fill={active ? car.color : "currentColor"}
        opacity={active ? 0.9 : 0.45}
      />
      {/* Rear wheel */}
      <circle cx={car.rearX} cy={wheelCy} r={wheelR}
        fill={active ? car.color : "currentColor"}
        opacity={active ? 0.9 : 0.45}
      />
      {/* Wheel rims */}
      <circle cx={car.frontX} cy={wheelCy} r={3.5}
        fill={active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)"}
      />
      <circle cx={car.rearX} cy={wheelCy} r={3.5}
        fill={active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)"}
      />
    </svg>
  );
};

// ─── CarPicker ────────────────────────────────────────────────────────────────

export const CarPicker = ({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (name: string | null) => void;
}) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CARS.map((car) => {
        const selected = value === car.name;
        return (
          <button
            key={car.name}
            type="button"
            onClick={() => onChange(selected ? null : car.name)}
            className={`flex flex-col items-center gap-1 px-2 pt-3 pb-2 rounded-xl border transition-all ${
              selected
                ? "border-2 bg-background/80 shadow-sm"
                : "border border-border/40 bg-background/40 hover:border-border/80 hover:bg-background/60"
            }`}
            style={selected ? { borderColor: car.color } : undefined}
          >
            <CarSilhouette car={car} size={72} active={selected} />
            <span className={`text-[11px] font-medium leading-tight text-center truncate w-full ${selected ? "text-foreground" : "text-muted-foreground"}`}>
              {car.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};
