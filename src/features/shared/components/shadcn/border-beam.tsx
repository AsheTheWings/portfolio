"use client"

import React from "react"
import { motion, MotionStyle, Transition } from "motion/react"

import { cn } from "@/lib/utils"

interface BorderBeamProps {
  /**
   * The size of the border beam.
   */
  size?: number
  /**
   * The delay of the border beam.
   */
  delay?: number
  /**
   * The color of the border beam from.
   */
  colorFrom?: string
  /**
   * The color of the border beam to.
   */
  colorTo?: string
  /**
   * The motion transition of the border beam.
   */
  transition?: Transition
  /**
   * The class name of the border beam.
   */
  className?: string
  /**
   * The style of the border beam.
   */
  style?: React.CSSProperties
  /**
   * Whether to reverse the animation direction.
   */
  reverse?: boolean
  /**
   * The initial offset position (0-100).
   */
  initialOffset?: number
  /**
   * The border width of the beam.
   */
  borderWidth?: number
  /**
   * Target speed in pixels per second when duration is not provided.
   * If provided, component computes duration = perimeter / pixelsPerSecond.
   */
  pixelsPerSecond?: number
}

export const BorderBeam = React.memo(function BorderBeam({
  className,
  size = 200,
  delay = 0,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
  pixelsPerSecond = 300,
}: BorderBeamProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [computedDuration, setComputedDuration] = React.useState<number>(6)
  const [offsetPathValue, setOffsetPathValue] = React.useState<string | undefined>(undefined)
  const [beamSize, setBeamSize] = React.useState<number>(size)
  const [shouldRender, setShouldRender] = React.useState<boolean>(true)

  // Compute perimeter-based duration and beam size, recalculate on resize
  React.useLayoutEffect(() => {
    const overlay = containerRef.current
    const el = overlay?.parentElement || overlay
    if (!el) return

    const computeDimensions = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.max(0, rect.width)
      const h = Math.max(0, rect.height)
      const perimeter = Math.max(0, 2 * (w + h))
      
      // Do not render if perimeter is too small
      if (perimeter < 100) {
        setShouldRender(false)
        return
      }
      
      setShouldRender(true)
      
      const maxR = Math.max(0, Math.min(w, h) / 2)
      // Beam head size scales with perimeter
      const dynamicSize = Math.min(maxR, Math.max(150, perimeter * 0.05)) // ~5% of perimeter, min 16px
      setBeamSize(dynamicSize)

      // Build rounded-rect path using computed radius
      const r = Math.min(dynamicSize, maxR)
      const path = `path('M ${r} 0 H ${Math.max(r, w - r)} A ${r} ${r} 0 0 1 ${w} ${r} V ${Math.max(r, h - r)} A ${r} ${r} 0 0 1 ${Math.max(r, w - r)} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${Math.max(r, h - r)} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z')`
      setOffsetPathValue(path)

      // Duration from perimeter and pixelsPerSecond (constant speed)
      const pps = Math.max(1, pixelsPerSecond)
      const durationSec = Math.max(3, (2 * (w + h - 2 * r) + 2 * Math.PI * r) / pps)
      setComputedDuration(durationSec)
    }

    // Initial computation
    const raf = requestAnimationFrame(computeDimensions)

    // Observe size changes
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(computeDimensions)
    })
    resizeObserver.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
    }
  }, [pixelsPerSecond, size])

  if (!shouldRender) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] [mask-composite:intersect] [mask-clip:padding-box,border-box]"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as React.CSSProperties
      }
    >
      <motion.div
        key={`beam-${computedDuration.toFixed(3)}`}
        className={cn(
          "absolute aspect-square",
          "bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent",
          className
        )}
        style={
          {
            width: beamSize,
            offsetPath: offsetPathValue ?? `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            willChange: "offset-distance",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            ...style,
          } as MotionStyle
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: computedDuration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  )
})
