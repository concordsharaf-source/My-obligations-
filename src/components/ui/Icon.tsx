/** Inline SVG icon set (no icon-font, no network). Stroke-based, RTL-neutral. */
import type { JSX } from 'react'
import { iconBody } from './iconSet'



export function Icon({
  name,
  size = 20,
  className = '',
  strokeWidth = 1.9,
}: {
  name: string
  size?: number
  className?: string
  strokeWidth?: number
}): JSX.Element {
  const body = iconBody(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  )
}

