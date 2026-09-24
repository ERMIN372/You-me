import type { JSX } from 'preact'

type P = { size?: number } & JSX.SVGAttributes<SVGSVGElement>

const base = (size = 22, rest: JSX.SVGAttributes<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.9,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  ...rest,
})

export const ICalendar = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </svg>
)
export const IGift = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="3.5" y="8" width="17" height="4.5" rx="1.2" />
    <path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5M12 8v13M12 8S10.5 3 7.8 3.6C5.8 4 6.4 8 12 8Zm0 0s1.5-5 4.2-4.4C18.2 4 17.6 8 12 8Z" />
  </svg>
)
export const IChat = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1-4.2A8.5 8.5 0 1 1 20.5 12Z" />
    <path d="M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5v.3M12 16.4v.1" />
  </svg>
)
export const ICart = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M2.5 3.5h2.3l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.4-1.1l1.8-7.3H6" />
    <circle cx="9.5" cy="20" r="1.3" />
    <circle cx="17" cy="20" r="1.3" />
  </svg>
)
export const ICard = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M6 9v6M8.5 9v6M11 9v6M14.5 9v6M17.5 9v6" />
  </svg>
)
export const IPlus = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IChevL = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)
export const IChevR = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)
export const ICheck = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
export const IX = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const ILink = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3A4.5 4.5 0 0 0 13 4.6l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  </svg>
)
export const ICamera = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M4 8h3l1.7-2.5h6.6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.6" />
  </svg>
)
export const IScan = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10" />
  </svg>
)
export const IUsers = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.3 3.3 0 0 1 0 6.4M18.3 14.8c1.8.7 2.9 2.4 3.2 5.2" />
  </svg>
)
export const IBell = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 21h4" />
  </svg>
)
export const IRefresh = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.7 4.3L20 15.5M20 20v-4.5h-4.5" />
  </svg>
)
export const ILock = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
)
export const ITrash = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 13.5h10l1-13.5" />
  </svg>
)
export const IEdit = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
  </svg>
)
export const IArchive = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
    <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" />
  </svg>
)
export const ISun = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
)
export const IImage = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="9.5" r="1.8" />
    <path d="m21 16-5-5-9 9" />
  </svg>
)
export const ICloudOff = ({ size, ...r }: P) => (
  <svg {...base(size, r)}>
    <path d="M3 3l18 18M8.5 6.2A6 6 0 0 1 17.7 10 4.5 4.5 0 0 1 20 18M17 19H7a5 5 0 0 1-1.6-9.7" />
  </svg>
)

export const Logo = ({ size = 30 }: { size?: number }) => (
  <svg width={size * 1.6} height={size} viewBox="0 0 48 30" aria-label="You&Me">
    <defs>
      <clipPath id="lg-l">
        <circle cx="15" cy="15" r="14" />
      </clipPath>
    </defs>
    <circle cx="15" cy="15" r="14" fill="#4b9cf5" />
    <circle cx="33" cy="15" r="14" fill="#ea7266" />
    <circle cx="33" cy="15" r="14" fill="#f3efe8" opacity="0.55" clip-path="url(#lg-l)" />
  </svg>
)
