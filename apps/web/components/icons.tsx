type IconName =
  | "search"
  | "filter"
  | "bookmark"
  | "pin"
  | "arrow"
  | "external"
  | "calendar"
  | "close"
  | "check"
  | "user"
  | "layers"
  | "chart"
  | "sliders"
  | "chevron"
  | "plus"
  | "code"
  | "briefcase"
  | "clock";

export function Icon({
  name,
  size = 18,
  filled = false,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    filter: <path d="M4 5h16l-6.5 7.5V19l-3 1v-7.5L4 5Z" />,
    bookmark: <path d="M6 4.5h12V21l-6-4-6 4V4.5Z" />,
    pin: (
      <>
        <path d="M19.5 10c0 5-7.5 11-7.5 11S4.5 15 4.5 10a7.5 7.5 0 1 1 15 0Z" />
        <circle cx="12" cy="10" r="2.3" />
      </>
    ),
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    external: (
      <>
        <path d="M13 4h7v7m0-7L10 14" />
        <path d="M9 6H5v14h14v-4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M7 3v4m10-4v4M3 10h18" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m4 12 5 5L20 6" />,
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5m-18 9" />
      </>
    ),
    chart: (
      <>
        <path d="M4 4v16h17M7 16l4-6 4 2 5-7" />
      </>
    ),
    sliders: (
      <>
        <path d="M3 7h7m4 0h7M3 17h11m4 0h3" />
        <circle cx="12" cy="7" r="2" />
        <circle cx="16" cy="17" r="2" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    code: (
      <>
        <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V4h8v3M3 12c5 3 13 3 18 0" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
