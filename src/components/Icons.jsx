// 단색 SVG 아이콘 모음 — UI에 컬러 이모지 대신 이것만 사용한다
const Icon = ({ children, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    {children}
  </svg>
)

export const PlayIcon = ({ size }) => (
  <Icon size={size}>
    <path d="M4.5 2.2v11.6L14 8z" />
  </Icon>
)

export const PauseIcon = ({ size }) => (
  <Icon size={size}>
    <path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z" />
  </Icon>
)

export const PrevIcon = ({ size }) => (
  <Icon size={size}>
    <path d="M2.5 2.5h2v11h-2zM13.5 2.5 6 8l7.5 5.5z" />
  </Icon>
)

export const NextIcon = ({ size }) => (
  <Icon size={size}>
    <path d="M11.5 2.5h2v11h-2zM2.5 2.5 10 8l-7.5 5.5z" />
  </Icon>
)

const StrokeIcon = ({ children, size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
)

export const ShuffleIcon = ({ size }) => (
  <StrokeIcon size={size}>
    <path d="M1.5 4.5h3l6 7h3" />
    <path d="M1.5 11.5h3l1.7-2" />
    <path d="M8.3 6.5l2.2-2h3" />
    <path d="M12 2.5l2 2-2 2" />
    <path d="M12 9.5l2 2-2 2" />
  </StrokeIcon>
)

export const RepeatOneIcon = ({ size }) => (
  <StrokeIcon size={size}>
    <path d="M11 3H5.5A3.5 3.5 0 0 0 2 6.5V7" />
    <path d="M9.5 1.5 11.5 3l-2 1.5" />
    <path d="M5 13h5.5A3.5 3.5 0 0 0 14 9.5V9" />
    <path d="M6.5 11.5 4.5 13l2 1.5" />
    <path d="M7.2 7.6 8.5 6.7v3.9" />
  </StrokeIcon>
)

export const FullscreenIcon = ({ size }) => (
  <Icon size={size}>
    <path d="M2 6V2h4v1.5H3.5V6zM10 2h4v4h-1.5V3.5H10zM14 10v4h-4v-1.5h2.5V10zM3.5 12.5H6V14H2v-4h1.5z" />
  </Icon>
)

export const VideoIcon = ({ size }) => (
  <Icon size={size}>
    <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h6.5A1.5 1.5 0 0 1 11 4.5v1.4l3.5-2.4v9l-3.5-2.4v1.4A1.5 1.5 0 0 1 9.5 13H3a1.5 1.5 0 0 1-1.5-1.5z" />
  </Icon>
)
