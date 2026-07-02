"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { FilterConfig } from "@/lib/types";
import { RotateCcw } from "lucide-react";

const PRESETS: {
  name: string;
  brightness: number;
  contrast: number;
  saturation: number;
}[] = [
  { name: "Normal", brightness: 1, contrast: 1, saturation: 1 },
  { name: "Vívido", brightness: 1.05, contrast: 1.15, saturation: 1.3 },
  { name: "P&B", brightness: 1, contrast: 1.1, saturation: 0 },
  { name: "Frio", brightness: 1, contrast: 1.05, saturation: 0.85 },
  { name: "Quente", brightness: 1.05, contrast: 1.05, saturation: 1.2 },
];

export function FiltersPanel({
  filters,
  onChange,
}: {
  filters: FilterConfig;
  onChange: (filters: FilterConfig) => void;
}) {
  function setValue(key: "brightness" | "contrast" | "saturation", v: number) {
    onChange({ ...filters, [key]: v, preset: null });
  }

  const SLIDERS: {
    key: "brightness" | "contrast" | "saturation";
    label: string;
    min: number;
  }[] = [
    { key: "brightness", label: "Brilho", min: 0.5 },
    { key: "contrast", label: "Contraste", min: 0.5 },
    { key: "saturation", label: "Saturação", min: 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Filtros</h3>
          <p className="text-xs text-muted-foreground">
            Ajustes de cor aplicados no preview e na exportação.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Restaurar padrão"
          onClick={() =>
            onChange({ brightness: 1, contrast: 1, saturation: 1, preset: "Normal" })
          }
        >
          <RotateCcw className="h-4 w-4" />
          <span className="sr-only">Restaurar padrão</span>
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Predefinições</Label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.name}
              type="button"
              size="sm"
              variant={filters.preset === p.name ? "default" : "outline"}
              className="text-xs"
              onClick={() =>
                onChange({
                  brightness: p.brightness,
                  contrast: p.contrast,
                  saturation: p.saturation,
                  preset: p.name,
                })
              }
            >
              {p.name}
            </Button>
          ))}
        </div>
      </div>

      {SLIDERS.map((s) => (
        <div key={s.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{s.label}</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {(filters[s.key] ?? 1).toFixed(2)}
            </span>
          </div>
          <Slider
            value={[filters[s.key] ?? 1]}
            min={s.min}
            max={1.5}
            step={0.01}
            onValueChange={(v) => setValue(s.key, v[0] ?? 1)}
          />
        </div>
      ))}
    </div>
  );
}
