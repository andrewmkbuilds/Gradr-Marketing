import { forwardRef } from "react";

/**
 * Official X (Twitter) brand mark. lucide-react does not ship the X glyph,
 * so this renders the official mark with `currentColor`.
 */
export const XIcon = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  function XIcon({ className, ...props }, ref) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        ref={ref}
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
      </svg>
    );
  },
);
