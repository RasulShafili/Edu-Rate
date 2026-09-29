import type { PoolClient } from "pg";
import { BASE_USER_SCHEMA_SQL, databasePool } from "./database.js";
import { BASE_BUSINESS_SCHEMA_SQL } from "./business.js";
import { BASE_PLATFORM_SCHEMA_SQL } from "./platform.js";
import { BASE_NETWORK_SCHEMA_SQL } from "./network.js";

type Migration = { version: number; name: string; sql: string };

const migrations: Migration[] = [
  {
    version: 0,
    name: "base application schema",
    sql: [BASE_USER_SCHEMA_SQL, BASE_BUSINESS_SCHEMA_SQL, BASE_PLATFORM_SCHEMA_SQL, BASE_NETWORK_SCHEMA_SQL].join("\n"),
  },
  {
    version: 1,
    name: "professional profiles and stable relations",
    sql: `
      CREATE TABLE IF NOT EXISTS professional_profiles (
        id UUID PRIMARY KEY,
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        kind VARCHAR(16) NOT NULL CHECK (kind IN ('teacher', 'mentor')),
        slug VARCHAR(120) NOT NULL UNIQUE,
        display_name VARCHAR(120) NOT NULL,
        headline VARCHAR(180) NOT NULL,
        specialty VARCHAR(180) NOT NULL,
        biography VARCHAR(1200) NOT NULL DEFAULT '',
        city VARCHAR(120) NOT NULL DEFAULT 'Xankəndi',
        experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
        availability VARCHAR(240) NOT NULL DEFAULT '',
        meeting_mode VARCHAR(80) NOT NULL DEFAULT 'Onlayn',
        languages TEXT[] NOT NULL DEFAULT '{}',
        expertise TEXT[] NOT NULL DEFAULT '{}',
        status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        visible BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS professional_profiles_catalog_idx
        ON professional_profiles (kind, status, visible, display_name);

      ALTER TABLE teacher_reviews ADD COLUMN IF NOT EXISTS teacher_profile_id UUID REFERENCES professional_profiles(id) ON DELETE RESTRICT;
      ALTER TABLE mentorship_requests ADD COLUMN IF NOT EXISTS mentor_profile_id UUID REFERENCES professional_profiles(id) ON DELETE RESTRICT;
      CREATE INDEX IF NOT EXISTS teacher_reviews_profile_idx ON teacher_reviews (teacher_profile_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS mentorship_requests_profile_idx ON mentorship_requests (mentor_profile_id, status, created_at DESC);
    `,
  },
  {
    version: 2,
    name: "support ownership and publishing states",
    sql: `
      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE announcements ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'published';
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'published';
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id, created_at DESC);
    `,
  },
  {
    version: 3,
    name: "connections and direct messages",
    sql: `
      CREATE TABLE IF NOT EXISTS connections (
        id UUID PRIMARY KEY,
        requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (requester_id <> recipient_id),
        UNIQUE (requester_id, recipient_id)
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS conversation_participants (
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (conversation_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(2000) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS messages_cursor_idx ON messages (conversation_id, created_at DESC, id DESC);
    `,
  },
  {
    version: 4,
    name: "administration audit history",
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(80) NOT NULL,
        entity_type VARCHAR(40) NOT NULL,
        entity_id VARCHAR(120) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
    `,
  },
  {
    version: 5,
    name: "unique direct relationships",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS connections_pair_unique
        ON connections (LEAST(requester_id,recipient_id), GREATEST(requester_id,recipient_id));
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS direct_key TEXT;
      UPDATE conversations c SET direct_key=(SELECT string_agg(cp.user_id::text,':' ORDER BY cp.user_id::text)
        FROM conversation_participants cp WHERE cp.conversation_id=c.id) WHERE direct_key IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS conversations_direct_key_unique ON conversations (direct_key);
    `,
  },
  {
    version: 6,
    name: "teacher mentor applications and dual professional profiles",
    sql: `
      ALTER TABLE professional_profiles DROP CONSTRAINT IF EXISTS professional_profiles_user_id_key;
      CREATE UNIQUE INDEX IF NOT EXISTS professional_profiles_user_kind_unique
        ON professional_profiles (user_id, kind) WHERE user_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS mentor_applications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        specialty VARCHAR(180) NOT NULL,
        biography VARCHAR(1200) NOT NULL,
        availability VARCHAR(240) NOT NULL,
        meeting_mode VARCHAR(80) NOT NULL,
        languages TEXT[] NOT NULL DEFAULT '{}',
        status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS mentor_applications_status_idx
        ON mentor_applications (status, created_at DESC);
    `,
  },
  {
    version: 7,
    name: "reconcile club membership counters",
    sql: `
      UPDATE clubs SET member_count = (
        SELECT COUNT(*)::int FROM club_memberships WHERE club_memberships.club_id = clubs.id
      );
      CREATE INDEX IF NOT EXISTS club_memberships_user_idx
        ON club_memberships (user_id, created_at DESC);
    `,
  },
  {
    version: 8,
    name: "database backed club profiles",
    sql: `
      UPDATE clubs SET
        short_name = name WHERE short_name = '';
      UPDATE clubs SET
        visual_mark = coordinator_initials WHERE visual_mark = '';
      UPDATE clubs SET
        description = category || ' istiqamətində tələbələri bir araya gətirən açıq universitet klubudur.'
        WHERE description = '';
      UPDATE clubs SET
        tagline = 'Birlikdə öyrən, yarat və kampusla paylaş.' WHERE tagline = '';
      UPDATE clubs SET
        about = jsonb_build_array(description) WHERE about = '[]'::jsonb;
      UPDATE clubs SET
        meeting = '{"cadence":"Yenilənir","day":"Cədvəl üzrə","time":"18:00","place":"Universitet kampusu"}'::jsonb
        WHERE meeting = '{}'::jsonb;
      UPDATE clubs SET focus_tags = ARRAY[category] WHERE cardinality(focus_tags) = 0;
    `,
  },
  {
    version: 9,
    name: "club group conversations and ownership",
    sql: `
      ALTER TABLE clubs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'direct';
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title VARCHAR(140);
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'member';
      CREATE UNIQUE INDEX IF NOT EXISTS conversations_club_unique ON conversations (club_id) WHERE club_id IS NOT NULL;

      INSERT INTO conversations (id, kind, club_id, title, created_by)
      SELECT gen_random_uuid(), 'club', clubs.id, clubs.name, clubs.created_by
      FROM clubs
      WHERE NOT EXISTS (SELECT 1 FROM conversations WHERE conversations.club_id = clubs.id);

      INSERT INTO conversation_participants (conversation_id, user_id, role)
      SELECT conversations.id, club_memberships.user_id,
        CASE WHEN club_memberships.user_id = clubs.created_by THEN 'admin' ELSE 'member' END
      FROM conversations
      JOIN clubs ON clubs.id = conversations.club_id
      JOIN club_memberships ON club_memberships.club_id = clubs.id
      WHERE conversations.kind = 'club'
      ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = EXCLUDED.role;

      INSERT INTO conversation_participants (conversation_id, user_id, role)
      SELECT conversations.id, clubs.created_by, 'admin'
      FROM conversations JOIN clubs ON clubs.id = conversations.club_id
      WHERE conversations.kind = 'club' AND clubs.created_by IS NOT NULL
      ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'admin';
    `,
  },
  {
    version: 10,
    name: "accepted mentorship conversations",
    sql: `
      UPDATE connections c SET status='accepted', updated_at=NOW()
      FROM mentorship_requests mr
      JOIN professional_profiles pp ON pp.id=mr.mentor_profile_id
      WHERE mr.status='accepted' AND pp.user_id IS NOT NULL AND c.status='pending'
        AND ((c.requester_id=mr.user_id AND c.recipient_id=pp.user_id)
          OR (c.requester_id=pp.user_id AND c.recipient_id=mr.user_id));

      INSERT INTO connections (id,requester_id,recipient_id,status)
      SELECT gen_random_uuid(), mr.user_id, pp.user_id, 'accepted'
      FROM mentorship_requests mr
      JOIN professional_profiles pp ON pp.id=mr.mentor_profile_id
      WHERE mr.status='accepted' AND pp.user_id IS NOT NULL AND mr.user_id<>pp.user_id
        AND NOT EXISTS (
          SELECT 1 FROM connections c
          WHERE (c.requester_id=mr.user_id AND c.recipient_id=pp.user_id)
             OR (c.requester_id=pp.user_id AND c.recipient_id=mr.user_id)
        )
      ON CONFLICT DO NOTHING;

      INSERT INTO conversations (id,direct_key,kind)
      SELECT gen_random_uuid(),
        LEAST(c.requester_id::text,c.recipient_id::text)||':'||GREATEST(c.requester_id::text,c.recipient_id::text),
        'direct'
      FROM connections c
      JOIN mentorship_requests mr ON mr.status='accepted'
        AND ((c.requester_id=mr.user_id) OR (c.recipient_id=mr.user_id))
      JOIN professional_profiles pp ON pp.id=mr.mentor_profile_id
        AND (c.requester_id=pp.user_id OR c.recipient_id=pp.user_id)
      WHERE c.status='accepted'
      ON CONFLICT (direct_key) DO NOTHING;

      INSERT INTO conversation_participants (conversation_id,user_id)
      SELECT c.id, split_part(c.direct_key,':',1)::uuid FROM conversations c
      WHERE c.kind='direct' AND c.direct_key IS NOT NULL
      ON CONFLICT DO NOTHING;
      INSERT INTO conversation_participants (conversation_id,user_id)
      SELECT c.id, split_part(c.direct_key,':',2)::uuid FROM conversations c
      WHERE c.kind='direct' AND c.direct_key IS NOT NULL
      ON CONFLICT DO NOTHING;
    `,
  },
  {
    version: 11,
    name: "verified identities revocable sessions and legal consent",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(32);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        user_agent VARCHAR(300) NOT NULL DEFAULT '',
        ip_address VARCHAR(80) NOT NULL DEFAULT '',
        expires_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id, revoked_at, expires_at DESC);

      CREATE TABLE IF NOT EXISTS auth_action_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('verify_email','reset_password','activate_account')),
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS auth_action_tokens_user_idx ON auth_action_tokens(user_id, purpose, created_at DESC);

      UPDATE users SET email_verified_at=COALESCE(email_verified_at, created_at)
      WHERE email_verified_at IS NULL AND created_at < NOW() - INTERVAL '1 minute';

      DELETE FROM teacher_reviews WHERE teacher_profile_id IN
        (SELECT id FROM professional_profiles WHERE user_id IS NULL);
      DELETE FROM mentorship_requests WHERE mentor_profile_id IN
        (SELECT id FROM professional_profiles WHERE user_id IS NULL);
      DELETE FROM professional_profiles WHERE user_id IS NULL;
    `,
  },
  {
    version: 12,
    name: "remove production demonstration catalog content",
    sql: `
      DELETE FROM event_registrations WHERE event_id IN ('future-forms','human-machine','afterlight','soft-reset');
      DELETE FROM events WHERE id IN ('future-forms','human-machine','afterlight','soft-reset');
      DELETE FROM club_memberships WHERE club_id IN (SELECT id FROM clubs WHERE created_by IS NULL);
      DELETE FROM conversations WHERE club_id IN (SELECT id FROM clubs WHERE created_by IS NULL);
      DELETE FROM clubs WHERE created_by IS NULL;
      DELETE FROM announcements WHERE id IN ('2026-orientation','2026-scholarship','2026-robotics-lab');
      DELETE FROM feed_posts WHERE id IN ('library-hours-august','frontend-team-august','engineering-showcase-august','digital-safety-august','debate-intake-august');
    `,
  },
  {
    version: 13,
    name: "message safety reports tombstones and mute controls",
    sql: `
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(240);
      ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS content_reports (
        id UUID PRIMARY KEY,
        reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
        entity_type VARCHAR(24) NOT NULL CHECK(entity_type IN ('message','profile','review','club')),
        entity_id VARCHAR(120) NOT NULL,
        reason VARCHAR(32) NOT NULL CHECK(reason IN ('abuse','threat','discrimination','spam','fake_profile','personal_data','other')),
        details VARCHAR(1000) NOT NULL DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        resolution_note VARCHAR(1000) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS content_reports_queue_idx ON content_reports(status,created_at DESC);
    `,
  },
  {
    version: 14,
    name: "verified cloud media assets",
    sql: `
      CREATE TABLE IF NOT EXISTS media_assets (
        id UUID PRIMARY KEY,
        owner_type VARCHAR(24) NOT NULL CHECK(owner_type IN ('avatar','club','announcement')),
        owner_id VARCHAR(120) NOT NULL,
        public_id VARCHAR(300) NOT NULL UNIQUE,
        secure_url VARCHAR(1000) NOT NULL,
        format VARCHAR(12) NOT NULL CHECK(format IN ('jpg','jpeg','png','webp')),
        bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 5242880),
        width INTEGER NOT NULL CHECK(width > 0 AND width <= 1600),
        height INTEGER NOT NULL CHECK(height > 0 AND height <= 1600),
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(owner_type,owner_id)
      );
      CREATE INDEX IF NOT EXISTS media_assets_owner_idx ON media_assets(owner_type,owner_id);
    `,
  },
  {
    version: 15,
    name: "announcement unique views and emoji reactions",
    sql: `
      CREATE TABLE IF NOT EXISTS announcement_views (
        announcement_id VARCHAR(120) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (announcement_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS announcement_reactions (
        announcement_id VARCHAR(120) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(12) NOT NULL CHECK (emoji IN ('👍','❤️','😂','😮','😢','👏','🎉','🤔','👎','🙏')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (announcement_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS announcement_reactions_item_idx ON announcement_reactions(announcement_id, emoji);
    `,
  },
  {
    version: 16,
    name: "event media and user announcement ownership",
    sql: `
      ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON announcements(created_by, status);
      ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_owner_type_check;
      ALTER TABLE media_assets ADD CONSTRAINT media_assets_owner_type_check
        CHECK(owner_type IN ('avatar','club','announcement','event'));
    `,
  },
  {
    version: 17,
    name: "club leaders and creator membership",
    sql: `
      ALTER TABLE club_memberships ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'member';
      ALTER TABLE club_memberships DROP CONSTRAINT IF EXISTS club_memberships_role_check;
      ALTER TABLE club_memberships ADD CONSTRAINT club_memberships_role_check CHECK(role IN ('member','leader'));
      INSERT INTO club_memberships(club_id,user_id,role)
      SELECT id,created_by,'leader' FROM clubs WHERE created_by IS NOT NULL
      ON CONFLICT(club_id,user_id) DO UPDATE SET role='leader';
      UPDATE conversation_participants SET role='admin'
      FROM conversations,clubs
      WHERE conversation_participants.conversation_id=conversations.id
        AND conversations.club_id=clubs.id
        AND conversation_participants.user_id=clubs.created_by;
      CREATE INDEX IF NOT EXISTS club_memberships_leaders_idx ON club_memberships(club_id,role);
    `,
  },
  {
    version: 18,
    name: "owner administration and privacy-safe account deletion",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS users_active_email_idx ON users(email) WHERE deleted_at IS NULL;

      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK(role IN ('student','mentor','teacher','assistant_admin','admin','owner_admin'));

      UPDATE users SET role='owner_admin',updated_at=NOW()
      WHERE id=(
        SELECT id FROM users
        WHERE role='admin' AND deleted_at IS NULL
        ORDER BY created_at ASC,id ASC
        LIMIT 1
      ) AND NOT EXISTS(
        SELECT 1 FROM users WHERE role='owner_admin' AND deleted_at IS NULL
      );
    `,
  },
  {
    version: 19,
    name: "persistent announcement reading state",
    sql: `
      CREATE TABLE IF NOT EXISTS announcement_user_state (
        announcement_id VARCHAR(120) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(announcement_id,user_id)
      );
      CREATE INDEX IF NOT EXISTS announcement_user_state_user_idx
        ON announcement_user_state(user_id,is_bookmarked,updated_at DESC);
    `,
  },
  {
    version: 20,
    name: "chat replies and message reactions",
    sql: `
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS message_reactions (
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(12) NOT NULL CHECK (emoji IN ('👍','❤️','😂','😮','😢','🙏')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (message_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON message_reactions(message_id);
    `,
  },
  {
    version: 21,
    name: "personal timetable",
    sql: `
      CREATE TABLE IF NOT EXISTS timetable_entries (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(120) NOT NULL,
        teacher VARCHAR(120) NOT NULL DEFAULT '',
        room VARCHAR(80) NOT NULL DEFAULT '',
        day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
        start_minute SMALLINT NOT NULL CHECK (start_minute >= 0 AND start_minute < 1440),
        end_minute SMALLINT NOT NULL CHECK (end_minute > 0 AND end_minute <= 1440),
        tone VARCHAR(16) NOT NULL DEFAULT 'mint',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (end_minute > start_minute)
      );
      CREATE INDEX IF NOT EXISTS timetable_entries_user_idx
        ON timetable_entries (user_id, day_of_week, start_minute);
    `,
  },
  {
    version: 22,
    name: "web push subscriptions",
    sql: `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent VARCHAR(300) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);
    `,
  },
  {
    version: 23,
    name: "campus questions and answers",
    sql: `
      CREATE TABLE IF NOT EXISTS campus_questions (
        id UUID PRIMARY KEY,
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(180) NOT NULL,
        body VARCHAR(1200) NOT NULL DEFAULT '',
        topic VARCHAR(32) NOT NULL DEFAULT 'kampus'
          CHECK (topic IN ('kampus','tedris','yasayis','texniki','diger')),
        status VARCHAR(16) NOT NULL DEFAULT 'published'
          CHECK (status IN ('published','hidden')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS campus_questions_feed_idx
        ON campus_questions (status, created_at DESC);

      CREATE TABLE IF NOT EXISTS campus_answers (
        id UUID PRIMARY KEY,
        question_id UUID NOT NULL REFERENCES campus_questions(id) ON DELETE CASCADE,
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        body VARCHAR(1200) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'published'
          CHECK (status IN ('published','hidden')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS campus_answers_question_idx
        ON campus_answers (question_id, created_at);

      CREATE TABLE IF NOT EXISTS campus_question_votes (
        question_id UUID NOT NULL REFERENCES campus_questions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (question_id, user_id)
      );
    `,
  },
  {
    version: 24,
    name: "student marketplace listings",
    sql: `
      CREATE TABLE IF NOT EXISTS marketplace_listings (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(140) NOT NULL,
        details VARCHAR(1000) NOT NULL DEFAULT '',
        kind VARCHAR(16) NOT NULL DEFAULT 'satiram'
          CHECK (kind IN ('satiram','axtariram','pulsuz','komek')),
        category VARCHAR(24) NOT NULL DEFAULT 'kitab'
          CHECK (category IN ('kitab','texnika','ders','yasayis','diger')),
        price VARCHAR(40) NOT NULL DEFAULT '',
        status VARCHAR(16) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','closed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS marketplace_listings_feed_idx
        ON marketplace_listings (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS marketplace_listings_user_idx
        ON marketplace_listings (user_id, created_at DESC);
    `,
  },
  {
    version: 25,
    name: "hide professional profiles of deleted accounts",
    sql: `
      UPDATE professional_profiles AS p
         SET visible = FALSE, updated_at = NOW()
        FROM users AS u
       WHERE p.user_id = u.id
         AND u.deleted_at IS NOT NULL
         AND p.visible = TRUE;
    `,
  },
  {
    version: 26,
    name: "clear placeholder biographies copied into professional profiles",
    sql: `
      UPDATE professional_profiles
         SET biography = '', updated_at = NOW()
       WHERE biography = 'EduRate icmasında universitet həyatını daha əlaqəli yaşamaq üçün buradayam.';
    `,
  },
  {
    version: 27,
    name: "per-account sign-in throttling and two-factor authentication",
    sql: `
      -- IP limitləri Vercel arxasında bütün istifadəçilər üçün ortaq idi; hesab
      -- üzrə uğursuz cəhdlər burada sayılır.
      CREATE TABLE IF NOT EXISTS auth_attempts (
        key VARCHAR(200) PRIMARY KEY,
        failures INTEGER NOT NULL DEFAULT 0,
        window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        locked_until TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS user_two_factor (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        secret_encrypted TEXT NOT NULL,
        enabled_at TIMESTAMPTZ,
        last_used_step BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS auth_recovery_codes (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash VARCHAR(64) NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS auth_recovery_codes_user_idx ON auth_recovery_codes(user_id, used_at);

      CREATE TABLE IF NOT EXISTS auth_login_challenges (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    version: 28,
    name: "personal notifications",
    sql: `
      -- Mətn saxlanmır: növ + parametrlər; interfeys onu seçilmiş dildə qurur.
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(40) NOT NULL,
        params JSONB NOT NULL DEFAULT '{}'::jsonb,
        url VARCHAR(300) NOT NULL DEFAULT '/',
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id) WHERE read_at IS NULL;
    `,
  },
  {
    version: 29,
    name: "announcement comments",
    sql: `
      -- Anonim şərhdə author_id yalnız moderasiya və "mənim şərhim" üçün saxlanılır;
      -- API onu heç vaxt qaytarmır.
      CREATE TABLE IF NOT EXISTS announcement_comments (
        id UUID PRIMARY KEY,
        announcement_id VARCHAR(120) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(600) NOT NULL,
        anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS announcement_comments_announcement_idx ON announcement_comments(announcement_id, created_at);
    `,
  },
  {
    version: 30,
    name: "email login code purpose",
    sql: `
      -- Girişdə e-poçtla 6 rəqəmli kod: yeni təyinat.
      ALTER TABLE auth_action_tokens DROP CONSTRAINT IF EXISTS auth_action_tokens_purpose_check;
      ALTER TABLE auth_action_tokens ADD CONSTRAINT auth_action_tokens_purpose_check
        CHECK (purpose IN ('verify_email','reset_password','activate_account','login_code'));
    `,
  },
];

export const latestMigrationVersion = Math.max(...migrations.map((migration) => migration.version));

export async function runMigrations() {
  if (!databasePool) return;
  await databasePool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  for (const migration of migrations) {
    const applied = await databasePool.query("SELECT 1 FROM schema_migrations WHERE version=$1", [migration.version]);
    if (applied.rowCount) continue;
    const client = await databasePool.connect();
    await applyMigration(client, migration);
  }
}

async function applyMigration(client: PoolClient, migration: Migration) {
  try {
    await client.query("BEGIN");
    await client.query(migration.sql);
    await client.query("INSERT INTO schema_migrations (version,name) VALUES ($1,$2)", [migration.version, migration.name]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
