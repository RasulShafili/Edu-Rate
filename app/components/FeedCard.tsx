"use client";

import { motion } from "framer-motion";
import {
  Bell,
  MessageCircleMore,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, memo } from "react";
import type {
  NetworkTone,
  StudentFeedItem,
  StudentFeedKind,
} from "../data/network";
import { useT } from "../i18n/LanguageProvider";
import { formatDateTimeWithMonths } from "../lib/date";

type FeedCardProps = {
  item: StudentFeedItem;
  position: number;
  total: number;
  reducedMotion: boolean;
};

type KindPresentation = {
  label: string;
  icon: LucideIcon;
};

const kindPresentation: Record<StudentFeedKind, KindPresentation> = {
  post: { label: "feed.kind.post", icon: MessageCircleMore },
  news: { label: "feed.kind.news", icon: Newspaper },
  notification: { label: "feed.kind.notification", icon: Bell },
};

const toneClasses: Record<
  NetworkTone,
  { accent: string; avatar: string; icon: string }
> = {
  lime: {
    accent: "before:bg-[#c8ff4d]",
    avatar: "bg-[#c8ff4d] text-[#0d0e0d]",
    icon: "bg-[#c8ff4d]/[0.18] text-[#547400]",
  },
  lilac: {
    accent: "before:bg-[#b9a7ff]",
    avatar: "bg-[#b9a7ff] text-[#0d0e0d]",
    icon: "bg-[#b9a7ff]/[0.22] text-[#5540b8]",
  },
  blue: {
    accent: "before:bg-[#77b8ff]",
    avatar: "bg-[#77b8ff] text-[#0d0e0d]",
    icon: "bg-[#77b8ff]/20 text-[#185f9f]",
  },
  coral: {
    accent: "before:bg-[#ff9e7a]",
    avatar: "bg-[#ff9e7a] text-[#0d0e0d]",
    icon: "bg-[#ff9e7a]/20 text-[#9d4026]",
  },
  mint: {
    accent: "before:bg-[#7de5d1]",
    avatar: "bg-[#7de5d1] text-[#0d0e0d]",
    icon: "bg-[#7de5d1]/[0.22] text-[#176c5f]",
  },
  gold: {
    accent: "before:bg-[#f7d56f]",
    avatar: "bg-[#f7d56f] text-[#0d0e0d]",
    icon: "bg-[#f7d56f]/[0.22] text-[#81640a]",
  },
};

const FeedCardBase = forwardRef<HTMLElement, FeedCardProps>(function FeedCard(
  { item, position, total, reducedMotion },
  ref,
) {
  const t = useT();
  // Server `timeLabel`-i hazir azerbaycanca qaytarir; ISO tarixden
  // formatlamaq tarixin de secilmis dilde olmasini temin edir.
  const months = Array.from({ length: 12 }, (_, index) => t(`month.${index + 1}`));
  const presentation = kindPresentation[item.kind];
  const tone = toneClasses[item.tone];
  const KindIcon = presentation.icon;
  const titleId = `feed-item-${item.id}-title`;

  return (
    <motion.article
      ref={ref}
      layout={reducedMotion ? false : "position"}
      className={`feed-card ${tone.accent} relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_22px_65px_rgba(0,0,0,0.24)] backdrop-blur-xl before:absolute before:inset-y-0 before:left-0 before:w-[3px] sm:p-6`}
      initial={reducedMotion ? false : { opacity: 0.62, y: 20, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -12, scale: 0.986 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              type: "spring",
              stiffness: 310,
              damping: 30,
              mass: 0.68,
              delay: Math.min((position - 1) % 5, 4) * 0.04,
            }
      }
      whileHover={reducedMotion ? undefined : { y: -5, scale: 1.01 }}
      aria-labelledby={titleId}
      aria-posinset={position}
      aria-setsize={total}
      tabIndex={0}
    >
      <div className="feed-card-header flex items-start justify-between gap-4">
        <div className="feed-card-source flex min-w-0 items-center gap-3">
          <span
            className={`feed-card-avatar ${tone.avatar} grid h-11 w-11 shrink-0 place-items-center rounded-[44%_56%_48%_52%] text-[11px] font-bold tracking-[0.08em]`}
            aria-hidden="true"
          >
            {item.sourceInitials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[var(--paper)]">
              {item.source}
            </p>
            <time
              className="mt-1 block text-[10px] tracking-[0.04em] text-[color:rgba(244,243,237,0.45)]"
              dateTime={item.publishedAt}
            >
              {formatDateTimeWithMonths(item.publishedAt, months)}
            </time>
          </div>
        </div>

        <span
          className={`feed-card-kind ${tone.icon} inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.1em]`}
        >
          <KindIcon size={13} strokeWidth={1.8} aria-hidden="true" />
          <span className="hidden sm:inline">{t(presentation.label)}</span>
        </span>
      </div>

      <div className="feed-card-body mt-6">
        <h3
          id={titleId}
          className="max-w-[780px] text-[clamp(23px,4vw,34px)] font-medium leading-[1.04] tracking-[-0.045em] text-[var(--paper)]"
        >
          {item.title}
        </h3>
        <p className="mt-3 max-w-[780px] text-[12px] leading-[1.7] text-[color:rgba(244,243,237,0.56)] sm:text-[13px]">
          {item.summary}
        </p>
      </div>

      <footer className="feed-card-footer mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-semibold tracking-[0.05em] text-[color:rgba(244,243,237,0.52)]"
          >
            {tag}
          </span>
        ))}
      </footer>
    </motion.article>
  );
});

FeedCardBase.displayName = "FeedCard";

export const FeedCard = memo(FeedCardBase);
