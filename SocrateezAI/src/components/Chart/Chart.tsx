import React from "react";
import {
  ResponsiveContainer,
  Tooltip,
  Legend } from
"recharts";
import { cn } from "../../lib/utils";

export type ChartConfig = { [k in
string]: {
  label?: React.ReactNode;
  icon?: React.ComponentType;
} & (
{color?: string;theme?: never;} |
{color?: never;theme: Record<"light" | "dark", string>;}) };



interface ChartContextProps {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          data-slot="chart"
          data-chart={chartId}
          className={cn(
            "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-none",
            className
          )}
          {...props}>
          
          <ChartStyle id={chartId} config={config} />
          <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
      </ChartContext.Provider>);

  }
);
ChartContainer.displayName = "ChartContainer";

const ChartStyle = ({ id, config }: {id: string;config: ChartConfig;}) => {
  const colorConfig = Object.entries(config).filter(
    ([, c]) => c.theme || c.color
  );
  if (!colorConfig.length) return null;

  const THEMES = { light: "", dark: ".dark" } as const;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES).
        map(
          ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.
          map(([key, itemConfig]) => {
            const color =
            itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
            itemConfig.color;
            return color ? `  --color-${key}: ${color};` : null;
          }).
          join("\n")}
}
`
        ).
        join("\n")
      }} />);


};

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    color?: string;
    type?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  className?: string;
  indicator?: "line" | "dot" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  nameKey?: string;
  labelKey?: string;
}

const ChartTooltipContent: React.FC<ChartTooltipContentProps> = ({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn("grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
      {!hideLabel && label && <div className="font-medium">{label}</div>}
      <div className="grid gap-1.5">
        {payload.
        filter((item) => item.type !== "none").
        map((item, index) =>
        <div key={index} className={cn("flex w-full flex-wrap items-stretch gap-2", indicator === "dot" && "items-center")}>
              {!hideIndicator &&
          <div className={cn("shrink-0 rounded-[2px]", { "h-2.5 w-2.5": indicator === "dot", "w-1": indicator === "line" })} style={{ backgroundColor: item.color }} />
          }
              <div className="flex flex-1 justify-between items-center leading-none">
                <span className="text-muted-foreground">{item.name}</span>
                {item.value !== undefined && <span className="font-mono font-medium text-foreground tabular-nums">{item.value.toLocaleString()}</span>}
              </div>
            </div>
        )}
      </div>
    </div>);

};

interface ChartLegendContentProps {
  className?: string;
  hideIcon?: boolean;
  payload?: Array<{
    value?: string;
    dataKey?: string;
    color?: string;
    type?: string;
  }>;
  verticalAlign?: "top" | "bottom";
  nameKey?: string;
}

const ChartLegendContent: React.FC<ChartLegendContentProps> = ({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom"
}) => {
  if (!payload?.length) return null;
  return (
    <div className={cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
      {payload.
      filter((item) => item.type !== "none").
      map((item, i) =>
      <div key={i} className="flex items-center gap-1.5">
            {!hideIcon && <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />}
            <span className="text-sm text-muted-foreground">{item.value}</span>
          </div>
      )}
    </div>);

};

export { ChartContainer, ChartTooltipContent, ChartLegendContent, ChartStyle, useChart };