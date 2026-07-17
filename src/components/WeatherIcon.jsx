import { WMO } from "../lib/weather.js";

// Hand-built inline SVG weather glyphs — outline style, stroke 1.6 round caps
// to match the Grand Tour icon set. Colours are theme tokens (amber sun,
// neutral clouds/rain) so they adapt to light/dark like the rest of the app.
const SUN = "var(--warning)";
const CLOUD = "var(--ink-faint)";
const CLOUD_DK = "var(--ink-muted)";
const RAIN = "var(--ink-muted)";
const SNOW = "var(--ink-faint)";
const BOLT = "var(--warning)";

const STROKE = { strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };

function Sun({ cx = 12, cy = 12, r = 4.5, color = SUN }) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 1.8);
    const y1 = cy + Math.sin(a) * (r + 1.8);
    const x2 = cx + Math.cos(a) * (r + 3.4);
    const y2 = cy + Math.sin(a) * (r + 3.4);
    rays.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} {...STROKE} />);
  }
  return (
    <g>
      {rays}
      <circle cx={cx} cy={cy} r={r} stroke={color} {...STROKE} />
    </g>
  );
}

// Cloud outline centered roughly at (12,14).
function Cloud({ color = CLOUD, x = 0, y = 0 }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M8 19h9.2a3.8 3.8 0 0 0 .3-7.6A5.6 5.6 0 0 0 6.9 12 4 4 0 0 0 8 19Z"
      stroke={color}
      {...STROKE}
    />
  );
}

function Drops({ color = RAIN, y = 20 }) {
  return (
    <g>
      {[8.5, 12, 15.5].map((x, i) => (
        <line key={i} x1={x} y1={y} x2={x - 1.2} y2={y + 2.6} stroke={color} {...STROKE} strokeWidth={1.8} />
      ))}
    </g>
  );
}

export default function WeatherIcon({ code = 2, size = 30, title }) {
  const { key, label } = WMO(code);
  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    role: "img",
    "aria-label": title || label,
  };

  switch (key) {
    case "clear":
      return <svg {...svgProps}><Sun cx={12} cy={12} r={5} /></svg>;

    case "partly":
      return (
        <svg {...svgProps}>
          <Sun cx={9} cy={9} r={3.4} />
          <Cloud color={CLOUD} x={1.5} y={1.5} />
        </svg>
      );

    case "overcast":
      return (
        <svg {...svgProps}>
          <Cloud color={CLOUD_DK} x={0} y={-2.5} />
          <Cloud color={CLOUD} x={0} y={1} />
        </svg>
      );

    case "fog":
      return (
        <svg {...svgProps}>
          <Cloud color={CLOUD} x={0} y={-2} />
          {[18.5, 21].map((y, i) => (
            <line key={i} x1="5" y1={y} x2="19" y2={y} stroke={CLOUD_DK} {...STROKE} />
          ))}
        </svg>
      );

    case "drizzle":
      return (
        <svg {...svgProps}>
          <Cloud color={CLOUD} x={0} y={-2} />
          <Drops color={RAIN} y={19} />
        </svg>
      );

    case "rain":
    case "showers":
      return (
        <svg {...svgProps}>
          {key === "showers" && <Sun cx={7} cy={7} r={2.6} />}
          <Cloud color={CLOUD_DK} x={0} y={-2} />
          <Drops color={RAIN} y={19} />
        </svg>
      );

    case "snow":
      return (
        <svg {...svgProps}>
          <Cloud color={CLOUD} x={0} y={-2} />
          {[8.5, 12, 15.5].map((x, i) => (
            <circle key={i} cx={x} cy={20.5} r="0.9" fill={SNOW} stroke="none" />
          ))}
        </svg>
      );

    case "thunder":
      return (
        <svg {...svgProps}>
          <Cloud color={CLOUD_DK} x={0} y={-2} />
          <path d="M12.5 17.5l-2.6 3.5h2.2l-1.2 3 3.6-4.5h-2.2l1.2-2Z" fill={BOLT} stroke="none" />
        </svg>
      );

    default:
      return (
        <svg {...svgProps}>
          <Cloud color={CLOUD} x={0} y={0} />
        </svg>
      );
  }
}
