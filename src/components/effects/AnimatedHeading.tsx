import { motion, type Variants } from "motion/react";
import { type ElementType } from "react";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { easeOut, viewportOnce } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

export type HeadingMotion = "mask" | "split" | "blur";

export interface AnimatedHeadingProps {
  /** Plain text so the heading stays selectable, translatable and crawlable. */
  text: string;
  as?: ElementType;
  className?: string;
  /** `mask` = line rises out of a clip mask, `split` = per-word stagger, `blur` = soft focus-in. */
  variant?: HeadingMotion;
  /** Play immediately (above the fold) instead of on scroll. */
  immediate?: boolean;
  delay?: number;
  /** Seconds between words for the split variant. */
  stride?: number;
  /** Zero-based word indices rendered in the accent treatment. */
  accentWords?: number[];
  accentClassName?: string;
}

const maskVariants: Variants = {
  hidden: { y: "108%", opacity: 0 },
  show: (d: number) => ({
    y: "0%",
    opacity: 1,
    transition: { duration: 0.85, ease: easeOut, delay: d },
  }),
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: "0.5em", rotateX: -38 },
  show: { opacity: 1, y: "0em", rotateX: 0, transition: { duration: 0.72, ease: easeOut } },
};

const blurVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(10px)" },
  show: (d: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: easeOut, delay: d },
  }),
};

/**
 * The single heading entrance for Gradr. Three registers — masked, split and
 * blur — all driven by the shared motion tokens so headings across marketing
 * and app surfaces move with one voice.
 *
 * Reduced motion renders static text with zero transforms.
 */
export function AnimatedHeading({
  text,
  as = "h2",
  className,
  variant = "mask",
  immediate = false,
  delay = 0,
  stride = 0.05,
  accentWords = [],
  accentClassName = "text-brand-secondary",
}: AnimatedHeadingProps) {
  const reduced = useReducedMotionPref();
  const words = text.split(" ");
  const Tag = as as ElementType;

  const accented = (word: string, i: number) => (
    <span className={accentWords.includes(i) ? accentClassName : undefined}>{word}</span>
  );

  if (reduced) {
    return (
      <Tag className={className}>
        {words.map((w, i) => (
          <span key={`${w}-${i}`}>
            {accented(w, i)}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </Tag>
    );
  }

  const play = immediate
    ? ({ animate: "show" } as const)
    : ({ whileInView: "show", viewport: viewportOnce } as const);

  if (variant === "mask") {
    const MotionTag = motion.create(Tag);
    return (
      <MotionTag className={cn("block overflow-hidden", className)} initial="hidden" {...play}>
        <motion.span className="block" variants={maskVariants} custom={delay}>
          {words.map((w, i) => (
            <span key={`${w}-${i}`}>
              {accented(w, i)}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </motion.span>
      </MotionTag>
    );
  }

  if (variant === "blur") {
    const MotionTag = motion.create(Tag);
    return (
      <MotionTag className={className} initial="hidden" variants={blurVariants} custom={delay} {...play}>
        {words.map((w, i) => (
          <span key={`${w}-${i}`}>
            {accented(w, i)}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </MotionTag>
    );
  }

  const MotionTag = motion.create(Tag);
  return (
    <MotionTag
      className={className}
      initial="hidden"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stride, delayChildren: delay } } }}
      style={{ perspective: 900 }}
      {...play}
    >
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block align-baseline">
          <motion.span
            variants={wordVariants}
            className={cn("inline-block", accentWords.includes(i) && accentClassName)}
            style={{ transformOrigin: "bottom center" }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </MotionTag>
  );
}

export default AnimatedHeading;
