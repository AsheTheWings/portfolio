import * as React from "react";

export function ThreeDotsScaleMiddleIcon({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="4" cy="12" r="1.5"><animate attributeName="r" dur="0.75s" repeatCount="indefinite" values="1.5;3;1.5"/></circle><circle cx="12" cy="12" r="3"><animate attributeName="r" dur="0.75s" repeatCount="indefinite" values="3;1.5;3"/></circle><circle cx="20" cy="12" r="1.5"><animate attributeName="r" dur="0.75s" repeatCount="indefinite" values="1.5;3;1.5"/></circle>
    </svg>
  );
}
