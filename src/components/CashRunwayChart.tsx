import React, { useId } from 'react';
import type { DayForecast, Paise } from '../types/finance.ts';
import { formatINR } from '../utils/formatters.ts';

export interface CashRunwayChartProps {
  baselineDays: DayForecast[];
  simulatedDays?: DayForecast[];
  safetyBufferPaise: Paise;
  title?: string;
  earliestShortfallDayIndex?: number | null;
  simulatedShortfallDayIndex?: number | null;
}

export const CashRunwayChart: React.FC<CashRunwayChartProps> = ({
  baselineDays,
  simulatedDays,
  safetyBufferPaise,
  title = '14-Day Cash Flow Trajectory',
  earliestShortfallDayIndex,
  simulatedShortfallDayIndex,
}) => {
  const chartId = useId();

  if (!baselineDays || baselineDays.length === 0) {
    return null;
  }

  // SVG ViewBox Dimensions
  const svgWidth = 720;
  const svgHeight = 240;
  const padding = { top: 28, right: 32, bottom: 44, left: 68 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Determine min and max values to bound Y-axis (including ₹0 and safety buffer)
  const allValuesPaise: number[] = [0, safetyBufferPaise];
  baselineDays.forEach((d) => allValuesPaise.push(d.minIntradayBalancePaise));
  if (simulatedDays) {
    simulatedDays.forEach((d) => allValuesPaise.push(d.minIntradayBalancePaise));
  }

  const rawMin = Math.min(...allValuesPaise);
  const rawMax = Math.max(...allValuesPaise);

  // Add headroom so lines do not clip against borders
  const range = rawMax - rawMin || 10000;
  const yMin = rawMin - range * 0.1;
  const yMax = rawMax + range * 0.12;

  const getX = (index: number) => {
    if (baselineDays.length <= 1) return padding.left;
    return padding.left + (index / (baselineDays.length - 1)) * plotWidth;
  };

  const getY = (valPaise: number) => {
    return padding.top + ((yMax - valPaise) / (yMax - yMin)) * plotHeight;
  };

  const yZero = getY(0);
  const yBuffer = getY(safetyBufferPaise);

  // Build SVG Path strings
  const buildLinePath = (days: DayForecast[]) => {
    return days
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.minIntradayBalancePaise).toFixed(1)}`)
      .join(' ');
  };

  const baselinePath = buildLinePath(baselineDays);
  const simulatedPath = simulatedDays ? buildLinePath(simulatedDays) : null;

  // Y-axis tick values (up to 4 ticks: min, 0, buffer, max)
  const yTicks = [
    { label: formatINR(yMax), y: getY(yMax) },
    { label: `${formatINR(safetyBufferPaise)} (Buffer)`, y: yBuffer, isBuffer: true },
    { label: '₹0 (Deficit line)', y: yZero, isZero: true },
    { label: formatINR(yMin), y: getY(yMin) },
  ].filter((tick, idx, arr) => {
    // Deduplicate ticks that are too close vertically (< 18px)
    return arr.findIndex((t) => Math.abs(t.y - tick.y) < 18) === idx;
  });

  return (
    <div className="cash-runway-chart-container" aria-labelledby={`${chartId}-title`}>
      <div className="chart-header">
        <h4 id={`${chartId}-title`} className="chart-title">
          {title}
        </h4>
        <div className="chart-legend" aria-hidden="true">
          <div className="legend-item">
            <span className="legend-marker marker-baseline">●</span>
            <span className="legend-text">Baseline (Intraday Lowest)</span>
          </div>
          {simulatedDays && (
            <div className="legend-item">
              <span className="legend-marker marker-simulated">◆</span>
              <span className="legend-text">With Opportunity (Hypothetical)</span>
            </div>
          )}
          <div className="legend-item">
            <span className="legend-marker marker-buffer">- -</span>
            <span className="legend-text">Safety Buffer ({formatINR(safetyBufferPaise)})</span>
          </div>
          <div className="legend-item">
            <span className="legend-marker marker-zero">━</span>
            <span className="legend-text">₹0 Shortfall Line</span>
          </div>
        </div>
      </div>

      {/* Screen Reader Accessible Data Summary */}
      <div className="sr-only">
        <p>
          14-day cash flow forecast chart from Day 1 to Day 14. Target safety buffer is{' '}
          {formatINR(safetyBufferPaise)}.
          {earliestShortfallDayIndex &&
            ` Earliest baseline shortfall occurs on Day ${earliestShortfallDayIndex}.`}
          {simulatedShortfallDayIndex &&
            ` In simulated opportunity, shortfall occurs on Day ${simulatedShortfallDayIndex}.`}
        </p>
        <table>
          <caption>Daily Intraday Lowest Balances</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th>Baseline Cash</th>
              {simulatedDays && <th>Simulated Cash</th>}
            </tr>
          </thead>
          <tbody>
            {baselineDays.map((d, i) => (
              <tr key={d.dayIndex}>
                <td>Day {d.dayIndex}</td>
                <td>{d.formattedDate}</td>
                <td>{formatINR(d.minIntradayBalancePaise)}</td>
                {simulatedDays && simulatedDays[i] && (
                  <td>{formatINR(simulatedDays[i].minIntradayBalancePaise)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Visual Responsive SVG Chart */}
      <div className="chart-svg-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="cash-runway-svg"
          role="img"
          aria-label={title}
        >
          <defs>
            {/* Deficit Shading Pattern below ₹0 */}
            <pattern id={`${chartId}-deficit-stripes`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#fecaca" strokeWidth="2" />
            </pattern>
          </defs>

          {/* Deficit Zone Area below ₹0 */}
          {yZero < svgHeight - padding.bottom && (
            <rect
              x={padding.left}
              y={Math.max(padding.top, yZero)}
              width={plotWidth}
              height={Math.max(0, svgHeight - padding.bottom - Math.max(padding.top, yZero))}
              fill={`url(#${chartId}-deficit-stripes)`}
              opacity={0.4}
            />
          )}

          {/* Safety Buffer Guide Line */}
          {yBuffer >= padding.top && yBuffer <= svgHeight - padding.bottom && (
            <g className="chart-guide-buffer">
              <line
                x1={padding.left}
                y1={yBuffer}
                x2={svgWidth - padding.right}
                y2={yBuffer}
                stroke="#d97706"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </g>
          )}

          {/* ₹0 Critical Threshold Line */}
          {yZero >= padding.top && yZero <= svgHeight - padding.bottom && (
            <g className="chart-guide-zero">
              <line
                x1={padding.left}
                y1={yZero}
                x2={svgWidth - padding.right}
                y2={yZero}
                stroke="#dc2626"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis & Ticks */}
          <line
            x1={padding.left}
            y1={svgHeight - padding.bottom}
            x2={svgWidth - padding.right}
            y2={svgHeight - padding.bottom}
            stroke="#d3cbbe"
            strokeWidth="1"
          />

          {baselineDays.map((d, i) => {
            const x = getX(i);
            const isShortfallDay = d.dayIndex === earliestShortfallDayIndex;
            return (
              <g key={`x-tick-${d.dayIndex}`}>
                <line
                  x1={x}
                  y1={svgHeight - padding.bottom}
                  x2={x}
                  y2={svgHeight - padding.bottom + 4}
                  stroke="#a8a29e"
                />
                <text
                  x={x}
                  y={svgHeight - padding.bottom + 16}
                  textAnchor="middle"
                  className={`chart-axis-label ${isShortfallDay ? 'label-shortfall-day' : ''}`}
                >
                  D{d.dayIndex}
                </text>
              </g>
            );
          })}

          {/* Y Axis Guide Lines & Values */}
          {yTicks.map((tick, idx) => (
            <g key={`y-tick-${idx}`}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={svgWidth - padding.right}
                y2={tick.y}
                stroke={tick.isZero ? '#dc2626' : tick.isBuffer ? '#d97706' : '#e7e2d7'}
                strokeWidth={tick.isZero ? 1.5 : 1}
                strokeDasharray={tick.isBuffer ? '4 3' : tick.isZero ? undefined : '2 2'}
                opacity={tick.isZero || tick.isBuffer ? 0.7 : 0.4}
              />
              <text
                x={padding.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                className={`chart-axis-label-y ${tick.isZero ? 'text-zero' : tick.isBuffer ? 'text-buffer' : ''}`}
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Baseline Trajectory Line */}
          <path
            d={baselinePath}
            fill="none"
            stroke="#0f766e"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Simulated Trajectory Line (if provided) */}
          {simulatedPath && (
            <path
              d={simulatedPath}
              fill="none"
              stroke="#4338ca"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Baseline Data Points */}
          {baselineDays.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.minIntradayBalancePaise);
            const isShortfall = d.minIntradayBalancePaise < 0;
            const isEarliestShortfall = d.dayIndex === earliestShortfallDayIndex;

            return (
              <g key={`pt-baseline-${d.dayIndex}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isEarliestShortfall ? 6 : 4}
                  fill={isShortfall ? '#dc2626' : '#0f766e'}
                  stroke="#ffffff"
                  strokeWidth={isEarliestShortfall ? 2.5 : 1.5}
                />
                {isEarliestShortfall && (
                  <g className="shortfall-callout">
                    <rect
                      x={Math.max(padding.left + 2, Math.min(svgWidth - padding.right - 74, cx - 36))}
                      y={Math.max(padding.top + 2, Math.min(svgHeight - padding.bottom - 22, cy - 26))}
                      width="72"
                      height="18"
                      rx="4"
                      fill="#b91c1c"
                    />
                    <text
                      x={Math.max(padding.left + 38, Math.min(svgWidth - padding.right - 38, cx))}
                      y={Math.max(padding.top + 14, Math.min(svgHeight - padding.bottom - 10, cy - 14))}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9.5"
                      fontWeight="bold"
                    >
                      Gap {formatINR(d.essentialShortfallPaise)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Simulated Data Points (Diamond/Square Markers) */}
          {simulatedDays &&
            simulatedDays.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.minIntradayBalancePaise);
              const isShortfall = d.minIntradayBalancePaise < 0;
              const isSimulatedShortfall = d.dayIndex === simulatedShortfallDayIndex;

              return (
                <g key={`pt-sim-${d.dayIndex}`}>
                  <rect
                    x={cx - (isSimulatedShortfall ? 5 : 3.5)}
                    y={cy - (isSimulatedShortfall ? 5 : 3.5)}
                    width={isSimulatedShortfall ? 10 : 7}
                    height={isSimulatedShortfall ? 10 : 7}
                    transform={`rotate(45 ${cx} ${cy})`}
                    fill={isShortfall ? '#b91c1c' : '#4338ca'}
                    stroke="#ffffff"
                    strokeWidth={isSimulatedShortfall ? 2 : 1.5}
                  />
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
};
