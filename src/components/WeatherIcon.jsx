import { WMO } from "../lib/weather.js";

// Hand-built inline SVG weather glyphs — crisp at any size, no icon library.
// One glyph per WMO bucket (see WMO() in lib/weather.js). Colors are fixed warm
// tones that read well on the app's light card backgrounds.
const SUN = "#F5A623";
const CLOUD = "#98A2AD";
const CLOUD_DK = "#6B7480";
const RAIN = "#4A90D9";
const SNOW = "#8FB8D8";
const BOLT = "#F2B705";

function Sun({ cx = 12, cy = 12, r = 4.5 }) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 1.8);
    const y1 = cy + Math.sin(a) * (r + 1.8);
    const x2 = cx + Math.cos(a) * (r + 3.6);
    const y2 = cy + Math.sin(a) * (r + 3.6);
    rays.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SUN} strokeWidth="1.6" strokeLinecap="round" />);
  }
  return (
    <g>
      {rays}
      <circle cx={cx} cy={cy} r={r} fill={SUN} />
    </g>
  );
}

// Cloud body centered roughly at (12,14).
function Cloud({ fill = CLOUD, x = 0, y = 0 }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M8 19h9.2a3.8 3.8 0 0 0 .3-7.6A5.6 5.6 0 0 0 6.9 12 4 4 0 0 0 8 19Z"
      fill={fill}
    />
  );
}

function Drops({ color = RAIN, ys = [21] }) {
  return (
    <g>
      {[8.5, 12, 15.5].map((x, i) => (
        <line key={i} x1={x} y1={ys[0]} x2={x - 1.2} y2={ys[0] + 2.6} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
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
          <Sun cx={9} cy={9} r={3.6} />
          <Cloud fill={CLOUD} x={1.5} y={1.5} />
        </svg>
      );

    case "overcast":
      return (
        <svg {...svgProps}>
          <Cloud fill={CLOUD_DK} x={0} y={-2.5} />
          <Cloud fill={CLOUD} x={0} y={1} />
        </svg>
      );

    case "fog":
      return (
        <svg {...svgProps}>
          <Cloud fill={CLOUD} x={0} y={-2} />
          {[18.5, 21].map((y, i) => (
            <line key={i} x1="5" y1={y} x2="19" y2={y} stroke={CLOUD_DK} strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </svg>
      );

    case "drizzle":
      return (
        <svg {...svgProps}>
          <Cloud fill={CLOUD} x={0} y={-2} />
          <Drops color={RAIN} ys={[20]} />
        </svg>
      );

    case "rain":
    case "showers":
      return (
        <svg {...svgProps}>
          {key === "showers" && <Sun cx={7} cy={7} r={2.8} />}
          <Cloud fill={CLOUD_DK} x={0} y={-2} />
          <Drops color={RAIN} ys={[20]} />
          <line x1="12" y1="20" x2="10.8" y2="23" stroke={RAIN} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case "snow":
      return (
        <svg {...svgProps}>
          <Cloud fill={CLOUD} x={0} y={-2} />
          {[8.5, 12, 15.5].map((x, i) => (
            <circle key={i} cx={x} cy={21} r="1.1" fill={SNOW} />
          ))}
        </svg>
      );

    case "thunder":
      return (
        <svg {...svgProps}>
          <Cloud fill={CLOUD_DK} x={0} y={-2} />
          <path d="M12.5 18l-3 4h2.4l-1.4 3 4-5h-2.4l1.4-2Z" fill={BOLT} />
        </svg>
      );

    default:
      return (
        <svg {...svgProps}>
          <Cloud fill={CLOUD} x={0} y={0} />
        </svg>
      );
  }
}
