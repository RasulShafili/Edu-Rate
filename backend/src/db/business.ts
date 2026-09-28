import { randomUUID } from "node:crypto";
import { events as seedEvents } from "../data/catalog.js";
import { ApiError } from "../lib/api-error.js";
import { databasePool } from "./database.js";
import { env } from "../config/env.js";
import { getMedia } from "./media.js";

export type EventCategory = "Design" | "Technology" | "Culture" | "Wellness";

export type EventRecord = {
  id: string;
  title: string;
  category: EventCategory;
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
  adminStatus?: "Açıq" | "Qaralama" | "Tamamlanıb";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
};

export type EventInput = Omit<EventRecord, "id" | "availableSpots" | "createdBy" | "createdAt" | "updatedAt"> & {
  availableSpots?: number;
};

export type MentorshipRequestRecord = {
  id: string;
  userId: string;
  mentorId: string;
  mentorProfileId?: string;
  note: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

const now = () => new Date().toISOString();
const memoryEvents = new Map<string, EventRecord>(
  seedEvents.map((event) => [
    event.id,
    {
      ...event,
      adminStatus: "Açıq",
      createdBy: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ]),
);
const memoryRegistrations = new Map<string, Set<string>>();
const memoryMentorshipRequests = new Map<string, MentorshipRequestRecord>();

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function mapEvent(row: Record<string, unknown>): EventRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    category: row.category as EventCategory,
    description: String(row.description),
    longDescription: String(row.long_description),
    location: String(row.location),
    city: String(row.city),
    organizer: String(row.organizer),
    startAt: iso(row.start_at),
    endAt: iso(row.end_at),
    registrationDeadline: iso(row.registration_deadline),
    speakers: Array.isArray(row.speakers) ? row.speakers.map(String) : [],
    capacity: Number(row.capacity),
    availableSpots: Number(row.available_spots),
    accent: String(row.accent),
    glow: String(row.glow),
    adminStatus: (row.admin_status ?? "Açıq") as EventRecord["adminStatus"],
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
  };
}

function mapMentorshipRequest(row: Record<string, unknown>): MentorshipRequestRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    mentorId: String(row.mentor_id),
    mentorProfileId: row.mentor_profile_id ? String(row.mentor_profile_id) : undefined,
    note: String(row.note ?? ""),
    status: row.status as MentorshipRequestRecord["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export const BASE_BUSINESS_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title VARCHAR(140) NOT NULL,
      category VARCHAR(30) NOT NULL CHECK (category IN ('Design', 'Technology', 'Culture', 'Wellness')),
      description VARCHAR(280) NOT NULL,
      long_description VARCHAR(1600) NOT NULL,
      location VARCHAR(180) NOT NULL,
      city VARCHAR(120) NOT NULL,
      organizer VARCHAR(180) NOT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      registration_deadline TIMESTAMPTZ NOT NULL,
      speakers JSONB NOT NULL DEFAULT '[]'::jsonb,
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      available_spots INTEGER NOT NULL CHECK (available_spots >= 0 AND available_spots <= capacity),
      accent VARCHAR(32) NOT NULL DEFAULT '#c8ff4d',
      glow VARCHAR(80) NOT NULL DEFAULT 'rgba(200, 255, 77, 0.28)',
      admin_status VARCHAR(24) NOT NULL DEFAULT 'Açıq',
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (end_at > start_at),
      CHECK (registration_deadline <= start_at)
    );

    CREATE INDEX IF NOT EXISTS events_start_at_idx ON events (start_at);
    CREATE INDEX IF NOT EXISTS events_category_idx ON events (category);
    ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_status VARCHAR(24) NOT NULL DEFAULT 'Açıq';
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_admin_status_check;
    ALTER TABLE events ADD CONSTRAINT events_admin_status_check CHECK (admin_status IN ('Açıq', 'Qaralama', 'Tamamlanıb'));

    CREATE TABLE IF NOT EXISTS event_registrations (
      id UUID PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS event_registrations_user_idx ON event_registrations (user_id);

    CREATE TABLE IF NOT EXISTS mentorship_requests (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mentor_id VARCHAR(120) NOT NULL,
      note VARCHAR(600) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS mentorship_requests_user_idx ON mentorship_requests (user_id, created_at DESC);
  `;

export async function initializeBusinessDatabase() {
  if (!databasePool) return;

  await databasePool.query(BASE_BUSINESS_SCHEMA_SQL);

  if (env.SEED_DEMO_DATA) for (const event of seedEvents) {
    await databasePool.query(
      `INSERT INTO events (
        id, title, category, description, long_description, location, city, organizer,
        start_at, end_at, registration_deadline, speakers, capacity, available_spots, accent, glow
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16)
      ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.title,
        event.category,
        event.description,
        event.longDescription,
        event.location,
        event.city,
        event.organizer,
        event.startAt,
        event.endAt,
        event.registrationDeadline,
        JSON.stringify(event.speakers),
        event.capacity,
        event.availableSpots,
        event.accent,
        event.glow,
      ],
    );
  }
}

/**
 * İstifadəçinin yaratdığı tədbirlər (hər vəziyyətdə). Əvvəl müəllim qaralamasını
 * göndərəndən sonra onun təsdiqləndiyini və ya silindiyini heç yerdə görmürdü.
 */
export async function listEventsByCreator(userId: string): Promise<EventRecord[]> {
  if (!databasePool) {
    return [...memoryEvents.values()]
      .filter((event) => event.createdBy === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30);
  }
  const result = await databasePool.query(
    "SELECT * FROM events WHERE created_by = $1 ORDER BY created_at DESC LIMIT 30",
    [userId],
  );
  return result.rows.map(mapEvent);
}

export async function listEvents(publicOnly = true): Promise<EventRecord[]> {
  if (!databasePool) {
    return Promise.all([...memoryEvents.values()]
      .filter((event) => !publicOnly || event.adminStatus === "Açıq")
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map(async(event)=>({...event,imageUrl:(await getMedia("event",event.id))?.secureUrl})));
  }
  const result = await databasePool.query(
    `SELECT events.*,media_assets.secure_url image_url FROM events
     LEFT JOIN media_assets ON media_assets.owner_type='event' AND media_assets.owner_id=events.id
     ${publicOnly ? "WHERE admin_status = 'Açıq'" : ""} ORDER BY start_at ASC`,
  );
  return result.rows.map(mapEvent);
}

export async function findEventById(id: string): Promise<EventRecord | null> {
  if (!databasePool) {const event=memoryEvents.get(id);return event?{...event,imageUrl:(await getMedia("event",id))?.secureUrl}:null;}
  const result = await databasePool.query("SELECT events.*,media_assets.secure_url image_url FROM events LEFT JOIN media_assets ON media_assets.owner_type='event' AND media_assets.owner_id=events.id WHERE events.id = $1 LIMIT 1", [id]);
  return result.rows[0] ? mapEvent(result.rows[0]) : null;
}

export async function createEvent(input: EventInput, userId: string): Promise<EventRecord> {
  const timestamp = now();
  const event: EventRecord = {
    ...input,
    id: `event-${randomUUID()}`,
    availableSpots: input.availableSpots ?? input.capacity,
    adminStatus: input.adminStatus ?? "Açıq",
    createdBy: userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (!databasePool) {
    memoryEvents.set(event.id, event);
    return event;
  }

  const result = await databasePool.query(
    `INSERT INTO events (
      id, title, category, description, long_description, location, city, organizer,
      start_at, end_at, registration_deadline, speakers, capacity, available_spots,
      accent, glow, created_by, admin_status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18)
    RETURNING *`,
    [
      event.id, event.title, event.category, event.description, event.longDescription,
      event.location, event.city, event.organizer, event.startAt, event.endAt,
      event.registrationDeadline, JSON.stringify(event.speakers), event.capacity,
      event.availableSpots, event.accent, event.glow, userId, event.adminStatus,
    ],
  );
  return mapEvent(result.rows[0]);
}

export async function updateEvent(id: string, input: EventInput): Promise<EventRecord | null> {
  if (!databasePool) {
    const current = memoryEvents.get(id);
    if (!current) return null;
    const registeredCount = current.capacity - current.availableSpots;
    if (input.capacity < registeredCount) {
      throw new ApiError(
        409,
        "CAPACITY_BELOW_REGISTRATIONS",
        `Tədbirin tutumu mövcud ${registeredCount} qeydiyyatdan az ola bilməz.`,
      );
    }
    const next = {
      ...current,
      ...input,
      adminStatus: input.adminStatus ?? current.adminStatus,
      availableSpots: Math.max(0, input.capacity - registeredCount),
      updatedAt: now(),
    };
    memoryEvents.set(id, next);
    return next;
  }

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [id]);
    if (!selected.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const current = mapEvent(selected.rows[0]);
    const registeredCount = current.capacity - current.availableSpots;
    if (input.capacity < registeredCount) {
      throw new ApiError(
        409,
        "CAPACITY_BELOW_REGISTRATIONS",
        `Tədbirin tutumu mövcud ${registeredCount} qeydiyyatdan az ola bilməz.`,
      );
    }
    const result = await client.query(
      `UPDATE events SET
        title=$2, category=$3, description=$4, long_description=$5, location=$6,
        city=$7, organizer=$8, start_at=$9, end_at=$10, registration_deadline=$11,
        speakers=$12::jsonb, capacity=$13, available_spots=$14,
        accent=$15, glow=$16, admin_status=COALESCE($17, admin_status), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [
        id, input.title, input.category, input.description, input.longDescription,
        input.location, input.city, input.organizer, input.startAt, input.endAt,
        input.registrationDeadline, JSON.stringify(input.speakers), input.capacity,
        input.capacity - registeredCount, input.accent, input.glow, input.adminStatus,
      ],
    );
    await client.query("COMMIT");
    return mapEvent(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  if (!databasePool) { memoryRegistrations.delete(id); return memoryEvents.delete(id); }
  const result = await databasePool.query("DELETE FROM events WHERE id=$1", [id]);
  return (result.rowCount ?? 0) > 0;
}

function assertRegistrationOpen(event: EventRecord) {
  if (event.adminStatus !== "Açıq") {
    throw new ApiError(409, "EVENT_NOT_PUBLISHED", "Bu tədbir ictimai qeydiyyat üçün açıq deyil.");
  }
  const currentTime = Date.now();
  if (new Date(event.registrationDeadline).getTime() < currentTime || new Date(event.startAt).getTime() <= currentTime) {
    throw new ApiError(409, "REGISTRATION_CLOSED", "Bu tədbir üçün qeydiyyat müddəti bitib.");
  }
  if (event.availableSpots < 1) {
    throw new ApiError(409, "EVENT_FULL", "Bu tədbirdə boş yer qalmayıb.");
  }
}

export async function registerForEvent(eventId: string, userId: string): Promise<EventRecord> {
  if (!databasePool) {
    const event = memoryEvents.get(eventId);
    if (!event) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
    assertRegistrationOpen(event);
    const registrations = memoryRegistrations.get(eventId) ?? new Set<string>();
    if (registrations.has(userId)) throw new ApiError(409, "ALREADY_REGISTERED", "Bu tədbirə artıq qeydiyyatdan keçmisən.");
    registrations.add(userId);
    memoryRegistrations.set(eventId, registrations);
    const next = { ...event, availableSpots: event.availableSpots - 1, updatedAt: now() };
    memoryEvents.set(eventId, next);
    return next;
  }

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    if (!selected.rows[0]) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
    const event = mapEvent(selected.rows[0]);
    assertRegistrationOpen(event);
    const duplicate = await client.query("SELECT 1 FROM event_registrations WHERE event_id=$1 AND user_id=$2", [eventId, userId]);
    if (duplicate.rows[0]) throw new ApiError(409, "ALREADY_REGISTERED", "Bu tədbirə artıq qeydiyyatdan keçmisən.");
    await client.query("INSERT INTO event_registrations (id,event_id,user_id) VALUES ($1,$2,$3)", [randomUUID(), eventId, userId]);
    const updated = await client.query("UPDATE events SET available_spots=available_spots-1, updated_at=NOW() WHERE id=$1 RETURNING *", [eventId]);
    await client.query("COMMIT");
    return mapEvent(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Başlamış və ya bitmiş tədbirdən imtina etmək mənasızdır: əvvəl imtina qəbul
 * olunurdu, boş yer sayı artırdı və iştirak tarixçəsi silinirdi.
 */
function assertNotStarted(event: EventRecord) {
  if (new Date(event.startAt).getTime() <= Date.now()) {
    throw new ApiError(409, "EVENT_STARTED", "Tədbir artıq başlayıb — qeydiyyatı ləğv etmək olmaz.");
  }
}

export async function cancelEventRegistration(eventId: string, userId: string): Promise<EventRecord> {
  if (!databasePool) {
    const event = memoryEvents.get(eventId);
    if (!event) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
    assertNotStarted(event);
    const registrations = memoryRegistrations.get(eventId);
    if (!registrations?.delete(userId)) throw new ApiError(404, "REGISTRATION_NOT_FOUND", "Aktiv qeydiyyat tapılmadı.");
    const next = { ...event, availableSpots: Math.min(event.capacity, event.availableSpots + 1), updatedAt: now() };
    memoryEvents.set(eventId, next);
    return next;
  }

  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [eventId]);
    if (!selected.rows[0]) throw new ApiError(404, "EVENT_NOT_FOUND", "Tədbir tapılmadı.");
    assertNotStarted(mapEvent(selected.rows[0]));
    const deleted = await client.query("DELETE FROM event_registrations WHERE event_id=$1 AND user_id=$2 RETURNING id", [eventId, userId]);
    if (!deleted.rows[0]) throw new ApiError(404, "REGISTRATION_NOT_FOUND", "Aktiv qeydiyyat tapılmadı.");
    const updated = await client.query("UPDATE events SET available_spots=LEAST(capacity, available_spots+1), updated_at=NOW() WHERE id=$1 RETURNING *", [eventId]);
    await client.query("COMMIT");
    return mapEvent(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Tədbirə yazılmış istifadəçilər — ləğv və dəyişiklik bildirişi üçün. */
export async function listEventRegistrantIds(eventId: string): Promise<string[]> {
  if (!databasePool) return [...(memoryRegistrations.get(eventId) ?? [])];
  const result = await databasePool.query("SELECT user_id FROM event_registrations WHERE event_id=$1", [eventId]);
  return result.rows.map((row) => String(row.user_id));
}

export async function listMyEventRegistrations(userId: string): Promise<EventRecord[]> {
  if (!databasePool) {
    return [...memoryRegistrations.entries()]
      .filter(([, users]) => users.has(userId))
      .map(([eventId]) => memoryEvents.get(eventId))
      .filter((event): event is EventRecord => Boolean(event));
  }
  const result = await databasePool.query(
    `SELECT e.* FROM events e
     INNER JOIN event_registrations r ON r.event_id=e.id
     WHERE r.user_id=$1 ORDER BY e.start_at ASC`,
    [userId],
  );
  return result.rows.map(mapEvent);
}

export async function createMentorshipRequest(userId: string, mentorId: string, note: string, mentorProfileId?: string): Promise<MentorshipRequestRecord> {
  if (!databasePool) {
    const duplicate = [...memoryMentorshipRequests.values()].find((item) => item.userId === userId
      && (mentorProfileId ? item.mentorProfileId === mentorProfileId : item.mentorId === mentorId)
      && (item.status === "pending" || item.status === "accepted"));
    if (duplicate) throw new ApiError(409, "REQUEST_EXISTS", duplicate.status === "accepted"
      ? "Bu mentorla aktiv mentorluğun artıq var."
      : "Bu mentor üçün gözləyən müraciətin artıq var.");
    const timestamp = now();
    const record: MentorshipRequestRecord = { id: randomUUID(), userId, mentorId, mentorProfileId, note, status: "pending", createdAt: timestamp, updatedAt: timestamp };
    memoryMentorshipRequests.set(record.id, record);
    return record;
  }
  const duplicate = await databasePool.query("SELECT status FROM mentorship_requests WHERE user_id=$1 AND (mentor_profile_id=$2 OR mentor_id=$3) AND status IN ('pending','accepted') LIMIT 1", [userId, mentorProfileId ?? null, mentorId]);
  if (duplicate.rows[0]) throw new ApiError(409, "REQUEST_EXISTS", duplicate.rows[0].status === "accepted"
    ? "Bu mentorla aktiv mentorluğun artıq var."
    : "Bu mentor üçün gözləyən müraciətin artıq var.");
  const result = await databasePool.query(
    "INSERT INTO mentorship_requests (id,user_id,mentor_id,mentor_profile_id,note) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [randomUUID(), userId, mentorId, mentorProfileId ?? null, note],
  );
  return mapMentorshipRequest(result.rows[0]);
}

export async function listMentorshipRequests(userId: string): Promise<MentorshipRequestRecord[]> {
  if (!databasePool) return [...memoryMentorshipRequests.values()].filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const result = await databasePool.query("SELECT * FROM mentorship_requests WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
  return result.rows.map(mapMentorshipRequest);
}

export async function listMentorRequests(mentorId: string, mentorProfileId?: string): Promise<MentorshipRequestRecord[]> {
  if (!databasePool) return [...memoryMentorshipRequests.values()].filter((item) => item.mentorId === mentorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const result = await databasePool.query("SELECT * FROM mentorship_requests WHERE mentor_id=$1 OR mentor_profile_id=$2 ORDER BY created_at DESC", [mentorId, mentorProfileId ?? null]);
  return result.rows.map(mapMentorshipRequest);
}

export async function decideMentorshipRequest(
  id: string,
  mentorId: string,
  status: Extract<MentorshipRequestRecord["status"], "accepted" | "rejected">,
  mentorProfileId?: string,
): Promise<MentorshipRequestRecord | null> {
  if (!databasePool) {
    const current = memoryMentorshipRequests.get(id);
    if (!current || current.mentorId !== mentorId || current.status !== "pending") return null;
    const next = { ...current, status, updatedAt: now() };
    memoryMentorshipRequests.set(id, next);
    return next;
  }
  const result = await databasePool.query(
    "UPDATE mentorship_requests SET status=$3, updated_at=NOW() WHERE id=$1 AND (mentor_id=$2 OR mentor_profile_id=$4) AND status='pending' RETURNING *",
    [id, mentorId, status, mentorProfileId ?? null],
  );
  return result.rows[0] ? mapMentorshipRequest(result.rows[0]) : null;
}

export async function endMentorshipRequest(
  id: string,
  mentorId: string,
  mentorProfileId?: string,
): Promise<MentorshipRequestRecord | null> {
  if (!databasePool) {
    const current = memoryMentorshipRequests.get(id);
    if (!current || current.mentorId !== mentorId || current.status !== "accepted") return null;
    const next: MentorshipRequestRecord = { ...current, status: "cancelled", updatedAt: now() };
    memoryMentorshipRequests.set(id, next);
    return next;
  }
  const result = await databasePool.query(
    "UPDATE mentorship_requests SET status='cancelled', updated_at=NOW() WHERE id=$1 AND (mentor_id=$2 OR mentor_profile_id=$3) AND status='accepted' RETURNING *",
    [id, mentorId, mentorProfileId ?? null],
  );
  return result.rows[0] ? mapMentorshipRequest(result.rows[0]) : null;
}

export async function updateMentorshipRequest(id: string, userId: string, note: string): Promise<MentorshipRequestRecord | null> {
  if (!databasePool) {
    const current = memoryMentorshipRequests.get(id);
    if (!current || current.userId !== userId || current.status !== "pending") return null;
    const next = { ...current, note, updatedAt: now() };
    memoryMentorshipRequests.set(id, next);
    return next;
  }
  const result = await databasePool.query("UPDATE mentorship_requests SET note=$3, updated_at=NOW() WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING *", [id, userId, note]);
  return result.rows[0] ? mapMentorshipRequest(result.rows[0]) : null;
}

export async function deleteMentorshipRequest(id: string, userId: string): Promise<boolean> {
  if (!databasePool) {
    const current = memoryMentorshipRequests.get(id);
    return Boolean(current && current.userId === userId && current.status === "pending" && memoryMentorshipRequests.delete(id));
  }
  const result = await databasePool.query("DELETE FROM mentorship_requests WHERE id=$1 AND user_id=$2 AND status='pending'", [id, userId]);
  return (result.rowCount ?? 0) > 0;
}
