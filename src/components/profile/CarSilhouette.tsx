export type CarOption = {
  name: string;
  color: string; // accent hex used for the pill highlight
};

export const CARS: CarOption[] = [
  { name: "Octane",      color: "#3b82f6" },
  { name: "Fennec",      color: "#8b5cf6" },
  { name: "Dominus",     color: "#f97316" },
  { name: "Breakout",    color: "#ef4444" },
  { name: "Merc",        color: "#6b7280" },
  { name: "Batmobile",   color: "#1d4ed8" },
  { name: "Mantis",      color: "#22c55e" },
  { name: "Road Hog",    color: "#f59e0b" },
  { name: "Paladin",     color: "#64748b" },
  { name: "Endo",        color: "#06b6d4" },
  { name: "Takumi",      color: "#ec4899" },
  { name: "Jäger 619",   color: "#6366f1" },
  { name: "Zippy",       color: "#84cc16" },
  { name: "Nimbus",      color: "#0ea5e9" },
  { name: "Twinzer",     color: "#a855f7" },
];

// ─── CarPicker ────────────────────────────────────────────────────────────────

export const CarPicker = ({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (name: string | null) => void;
}) => (
  <div className="grid grid-cols-3 gap-2">
    {CARS.map((car) => {
      const selected = value === car.name;
      return (
        <button
          key={car.name}
          type="button"
          onClick={() => onChange(selected ? null : car.name)}
          className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left truncate ${
            selected
              ? "border-2 text-foreground"
              : "border border-border/40 text-muted-foreground bg-background/40 hover:border-border/70 hover:text-foreground hover:bg-background/60"
          }`}
          style={selected ? { borderColor: car.color, backgroundColor: `${car.color}18`, color: car.color } : undefined}
        >
          {car.name}
        </button>
      );
    })}
  </div>
);

// ─── CarBadge (used in view mode) ─────────────────────────────────────────────

export const CarBadge = ({ car }: { car: CarOption }) => (
  <span
    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
    style={{ backgroundColor: `${car.color}20`, color: car.color, border: `1px solid ${car.color}40` }}
  >
    {car.name}
  </span>
);

// Keep CarSilhouette as a no-op export so any stale import doesn't break
export const CarSilhouette = () => null;
