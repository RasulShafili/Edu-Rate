import { bakuDateParts } from "../lib/date";

export type EventCategory = "Design" | "Technology" | "Culture" | "Wellness";

export type Event = {
  id: string;
  category: EventCategory;
  /** Bakı vaxtı ilə günün iki rəqəmli yazılışı ("05"). */
  date: string;
  /** Bakı vaxtı ilə ay (1–12); adı lüğətdən (`month.*`, `monthShort.*`) gəlir. */
  monthIndex: number;
  year: number;
  time: string;
  title: string;
  location: string;
  city: string;
  description: string;
  longDescription: string;
  accent: string;
  glow: string;
  speakers: string[];
  /** Tutum (neçə nəfərlik), qeydiyyatdan keçənlərin sayı deyil. */
  capacity: number;
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  organizer: string;
  availableSpots: number;
  imageUrl?: string;
};

export const categories = [
  "All",
  "Design",
  "Technology",
  "Culture",
  "Wellness",
] as const;

export type EventFilter = (typeof categories)[number];

export type ApiEvent = {
  id: string;
  category: EventCategory;
  title: string;
  description: string;
  longDescription: string;
  location: string;
  city: string;
  organizer: string;
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  speakers: string[];
  capacity: number;
  availableSpots: number;
  accent: string;
  glow: string;
  imageUrl?: string;
};

export function mapApiEvent(event: ApiEvent): Event {
  const { day, month, year, time } = bakuDateParts(event.startAt);
  return { ...event, date: day, monthIndex: month, year, time };
}
