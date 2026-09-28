import { randomUUID } from "node:crypto";
import { ApiError } from "../lib/api-error.js";
import { databasePool, listUsers } from "./database.js";
import { getMedia } from "./media.js";

export type CommunityUser = { id: string; name: string; role: string; faculty: string; program: string; city: string; avatarUrl?:string };
export type Connection = { id: string; requesterId: string; recipientId: string; status: "pending" | "accepted" | "blocked"; createdAt: string };
export type Conversation = { id: string; peer: CommunityUser; lastMessage: string; updatedAt: string; unreadCount: number; muted:boolean };
export type ClubConversation = { id: string; kind: "club"; club: { id: string; slug: string; name: string }; memberCount: number; isAdmin: boolean; lastMessage: string; updatedAt: string; unreadCount: number; muted:boolean };
export const MESSAGE_REACTIONS = ["👍","❤️","😂","😮","😢","🙏"] as const;
export type MessageReactionEmoji = (typeof MESSAGE_REACTIONS)[number];
export type MessageReaction = { emoji: MessageReactionEmoji; count: number; mine: boolean };
export type ReplyPreview = { id: string; senderName: string; body: string; deleted: boolean };
export type Message = { id: string; conversationId: string; senderId: string; senderName: string; senderInitials: string; senderAvatarUrl?:string; body: string; createdAt: string; deleted?:boolean; editedAt?:string; replyToId?:string; replyTo?:ReplyPreview; reactions?:MessageReaction[]; status?:"sent"|"read" };
export type ContentReport = { id:string; reporterId:string; entityType:"message"|"profile"|"review"|"club"; entityId:string; reason:string; details:string; status:"open"|"reviewing"|"resolved"|"dismissed"; reviewedBy:string|null; resolutionNote:string; createdAt:string; updatedAt:string };

type MemoryConversation = { id: string; participants: string[]; updatedAt: string; kind: "direct" | "club"; clubId?: string; clubSlug?: string; title?: string; createdBy?: string | null; mutedParticipants?:Set<string>; lastReadAt?:Map<string,string> };

const connections = new Map<string, Connection>();
const conversations = new Map<string, MemoryConversation>();
const messages = new Map<string, Message[]>();
const messageReactions = new Map<string, Map<string, MessageReactionEmoji>>();
const reports = new Map<string, ContentReport>();
const now = () => new Date().toISOString();
const iso = (value: unknown) => new Date(String(value)).toISOString();
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join("");

export async function listCommunityUsers(currentUserId: string): Promise<CommunityUser[]> {
  if (!databasePool) return Promise.all((await listUsers(100)).filter((user) => user.id !== currentUserId && user.status === "Aktiv").map(async(user)=>({...toCommunityUser(user),avatarUrl:(await getMedia("avatar",user.id))?.secureUrl})));
  const result = await databasePool.query("SELECT users.id,users.name,users.role,users.faculty,users.program,users.city,media_assets.secure_url avatar_url FROM users LEFT JOIN media_assets ON media_assets.owner_type='avatar' AND media_assets.owner_id=users.id::text WHERE users.id<>$1 AND users.status='Aktiv' ORDER BY users.updated_at DESC LIMIT 100", [currentUserId]);
  return result.rows.map((row) => ({ id: String(row.id), name: String(row.name), role: String(row.role), faculty: String(row.faculty), program: String(row.program), city: String(row.city),avatarUrl:row.avatar_url?String(row.avatar_url):undefined }));
}

export async function listConnections(userId: string): Promise<Connection[]> {
  if (!databasePool) return [...connections.values()].filter((connection) => connection.requesterId === userId || connection.recipientId === userId);
  const result = await databasePool.query("SELECT * FROM connections WHERE requester_id=$1 OR recipient_id=$1 ORDER BY created_at DESC", [userId]);
  return result.rows.map(mapConnection);
}

export async function createConnection(requesterId: string, recipientId: string): Promise<Connection> {
  if (requesterId === recipientId) throw new ApiError(422, "SELF_CONNECTION", "Öz hesabına əlaqə göndərmək olmaz.");
  if (!databasePool) {
    const existing = [...connections.values()].find((connection) => pairMatches(connection, requesterId, recipientId));
    if (existing) return existing;
    const connection = { id: randomUUID(), requesterId, recipientId, status: "pending" as const, createdAt: now() };
    connections.set(connection.id, connection);
    return connection;
  }
  const target = await databasePool.query("SELECT 1 FROM users WHERE id=$1 AND status='Aktiv'", [recipientId]);
  if (!target.rowCount) throw new ApiError(404, "USER_NOT_FOUND", "Aktiv istifadəçi tapılmadı.");
  const existing = await databasePool.query("SELECT * FROM connections WHERE (requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1) LIMIT 1", [requesterId, recipientId]);
  if (existing.rows[0]) return mapConnection(existing.rows[0]);
  const result = await databasePool.query("INSERT INTO connections(id,requester_id,recipient_id) VALUES($1,$2,$3) RETURNING *", [randomUUID(), requesterId, recipientId]);
  return mapConnection(result.rows[0]);
}

export async function acceptConnection(id: string, userId: string): Promise<Connection | null> {
  if (!databasePool) {
    const connection = connections.get(id);
    if (!connection || connection.recipientId !== userId) return null;
    connection.status = "accepted";
    return connection;
  }
  const result = await databasePool.query("UPDATE connections SET status='accepted',updated_at=NOW() WHERE id=$1 AND recipient_id=$2 AND status='pending' RETURNING *", [id, userId]);
  return result.rows[0] ? mapConnection(result.rows[0]) : null;
}

export async function ensureMentorshipConversation(studentId: string, mentorId: string): Promise<{ id: string }> {
  if (studentId === mentorId) throw new ApiError(422, "SELF_MENTORSHIP", "Öz hesabınla mentorluq söhbəti yaratmaq olmaz.");
  if (!databasePool) {
    const existing = [...connections.values()].find((connection) => pairMatches(connection, studentId, mentorId));
    if (existing) {
      existing.status = "accepted";
    } else {
      const connection: Connection = { id: randomUUID(), requesterId: studentId, recipientId: mentorId, status: "accepted", createdAt: now() };
      connections.set(connection.id, connection);
    }
    return createConversation(studentId, mentorId);
  }

  const existing = await databasePool.query(
    "SELECT * FROM connections WHERE (requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1) LIMIT 1",
    [studentId, mentorId],
  );
  if (existing.rows[0]) {
    await databasePool.query("UPDATE connections SET status='accepted',updated_at=NOW() WHERE id=$1", [existing.rows[0].id]);
  } else {
    await databasePool.query(
      "INSERT INTO connections(id,requester_id,recipient_id,status) VALUES($1,$2,$3,'accepted') ON CONFLICT DO NOTHING",
      [randomUUID(), studentId, mentorId],
    );
  }
  return createConversation(studentId, mentorId);
}

export async function deleteConnection(id: string, userId: string): Promise<boolean> {
  if (!databasePool) {
    const connection = connections.get(id);
    const canDelete = connection && (connection.status === "blocked" ? connection.requesterId === userId : connection.requesterId === userId || connection.recipientId === userId);
    return Boolean(canDelete && connections.delete(id));
  }
  const result = await databasePool.query("DELETE FROM connections WHERE id=$1 AND ((status='blocked' AND requester_id=$2) OR (status<>'blocked' AND (requester_id=$2 OR recipient_id=$2)))", [id, userId]);
  return Boolean(result.rowCount);
}

export async function blockConnection(userId:string,peerId:string){
  if(userId===peerId)throw new ApiError(422,"SELF_BLOCK","Öz hesabını bloklamaq olmaz.");
  if(!databasePool){const existing=[...connections.values()].find((item)=>pairMatches(item,userId,peerId));if(existing)existing.status="blocked";else {const id=randomUUID();connections.set(id,{id,requesterId:userId,recipientId:peerId,status:"blocked",createdAt:now()});}return;}
  const existing=await databasePool.query("SELECT id FROM connections WHERE (requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1) LIMIT 1",[userId,peerId]);
  if(existing.rows[0])await databasePool.query("UPDATE connections SET status='blocked',requester_id=$1,recipient_id=$2,updated_at=NOW() WHERE id=$3",[userId,peerId,existing.rows[0].id]);
  else await databasePool.query("INSERT INTO connections(id,requester_id,recipient_id,status) VALUES($1,$2,$3,'blocked')",[randomUUID(),userId,peerId]);
}

export async function unblockConnection(userId:string,peerId:string):Promise<boolean>{
  if(!databasePool){
    const existing=[...connections.values()].find((item)=>item.requesterId===userId&&item.recipientId===peerId&&item.status==="blocked");
    return Boolean(existing&&connections.delete(existing.id));
  }
  const result=await databasePool.query("DELETE FROM connections WHERE requester_id=$1 AND recipient_id=$2 AND status='blocked'",[userId,peerId]);
  return Boolean(result.rowCount);
}

export async function createConversation(userId: string, peerId: string): Promise<{ id: string }> {
  await assertConnected(userId, peerId);
  if (!databasePool) {
    const found = [...conversations.values()].find((conversation) => conversation.kind === "direct" && conversation.participants.includes(userId) && conversation.participants.includes(peerId));
    if (found) return { id: found.id };
    const conversation: MemoryConversation = { id: randomUUID(), participants: [userId, peerId], updatedAt: now(), kind: "direct" };
    conversations.set(conversation.id, conversation);
    return { id: conversation.id };
  }
  const directKey = [userId, peerId].sort().join(":");
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query("INSERT INTO conversations(id,direct_key,kind) VALUES($1,$2,'direct') ON CONFLICT (direct_key) DO UPDATE SET direct_key=EXCLUDED.direct_key RETURNING id", [randomUUID(), directKey]);
    const id = String(inserted.rows[0].id);
    await client.query("INSERT INTO conversation_participants(conversation_id,user_id) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING", [id, userId, peerId]);
    await client.query("COMMIT");
    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  if (!databasePool) {
    const users = await listUsers(1000);
    const items:Conversation[]=[];
    for(const conversation of [...conversations.values()].filter((item) => item.kind === "direct" && item.participants.includes(userId))){
      const peer = users.find((user) => conversation.participants.includes(user.id) && user.id !== userId);
      if (!peer) continue;
      const connection=[...connections.values()].find((item)=>pairMatches(item,userId,peer.id));
      if(connection?.status!=="accepted")continue;
      const avatarUrl=(await getMedia("avatar",peer.id))?.secureUrl;
      items.push({ id: conversation.id, peer: {...toCommunityUser(peer),...(avatarUrl?{avatarUrl}:{})}, lastMessage: messages.get(conversation.id)?.at(-1)?.body ?? "", updatedAt: conversation.updatedAt, unreadCount: 0, muted:Boolean(conversation.mutedParticipants?.has(userId)) });
    }
    return items;
  }
  const result = await databasePool.query(`SELECT c.id,c.updated_at,u.id peer_id,u.name,u.role,u.faculty,u.program,u.city,media_assets.secure_url avatar_url,(me.muted_until>NOW()) muted,
    COALESCE((SELECT CASE WHEN deleted_at IS NOT NULL THEN 'Mesaj silindi' ELSE body END FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1),'') last_message,
    (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.created_at>COALESCE(me.last_read_at,'epoch')) unread_count
    FROM conversations c JOIN conversation_participants me ON me.conversation_id=c.id AND me.user_id=$1
    JOIN conversation_participants other ON other.conversation_id=c.id AND other.user_id<>$1 JOIN users u ON u.id=other.user_id
    LEFT JOIN media_assets ON media_assets.owner_type='avatar' AND media_assets.owner_id=u.id::text
    WHERE c.kind='direct' AND EXISTS(SELECT 1 FROM connections cn WHERE cn.status='accepted' AND ((cn.requester_id=$1 AND cn.recipient_id=u.id) OR (cn.recipient_id=$1 AND cn.requester_id=u.id))) ORDER BY c.updated_at DESC`, [userId]);
  return result.rows.map((row) => ({ id: String(row.id), peer: { id: String(row.peer_id), name: String(row.name), role: String(row.role), faculty: String(row.faculty), program: String(row.program), city: String(row.city),avatarUrl:row.avatar_url?String(row.avatar_url):undefined }, lastMessage: String(row.last_message), updatedAt: iso(row.updated_at), unreadCount: Number(row.unread_count), muted:Boolean(row.muted) }));
}

export async function ensureClubConversation(club: { id: string; slug: string; name: string; createdBy?: string | null }) {
  if (!databasePool) {
    const found = [...conversations.values()].find((conversation) => conversation.kind === "club" && conversation.clubId === club.id);
    if (found) return { id: found.id };
    const conversation: MemoryConversation = { id: randomUUID(), participants: club.createdBy ? [club.createdBy] : [], updatedAt: now(), kind: "club", clubId: club.id, clubSlug: club.slug, title: club.name, createdBy: club.createdBy ?? null };
    conversations.set(conversation.id, conversation);
    return { id: conversation.id };
  }
  const result = await databasePool.query(`INSERT INTO conversations(id,kind,club_id,title,created_by) VALUES($1,'club',$2,$3,$4)
    ON CONFLICT (club_id) WHERE club_id IS NOT NULL DO UPDATE SET title=EXCLUDED.title RETURNING id`, [randomUUID(), club.id, club.name, club.createdBy ?? null]);
  const id = String(result.rows[0].id);
  if (club.createdBy) await databasePool.query("INSERT INTO conversation_participants(conversation_id,user_id,role) VALUES($1,$2,'admin') ON CONFLICT(conversation_id,user_id) DO UPDATE SET role='admin'", [id, club.createdBy]);
  return { id };
}

export async function addClubConversationMember(club: { id: string; slug: string; name: string; createdBy?: string | null }, userId: string) {
  const { id } = await ensureClubConversation(club);
  if (!databasePool) {
    const conversation = conversations.get(id)!;
    if (!conversation.participants.includes(userId)) conversation.participants.push(userId);
    return;
  }
  await databasePool.query("INSERT INTO conversation_participants(conversation_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(conversation_id,user_id) DO NOTHING", [id, userId, club.createdBy === userId ? "admin" : "member"]);
}

export async function removeClubConversationMember(clubId: string, userId: string) {
  if (!databasePool) {
    const conversation = [...conversations.values()].find((item) => item.kind === "club" && item.clubId === clubId);
    if (conversation && conversation.createdBy !== userId) conversation.participants = conversation.participants.filter((id) => id !== userId);
    return;
  }
  await databasePool.query(`DELETE FROM conversation_participants USING conversations
    WHERE conversation_participants.conversation_id=conversations.id AND conversations.club_id=$1
      AND conversation_participants.user_id=$2 AND conversations.created_by IS DISTINCT FROM $2`, [clubId, userId]);
}

export async function listClubConversations(userId: string): Promise<ClubConversation[]> {
  if (!databasePool) return [...conversations.values()].filter((conversation) => conversation.kind === "club" && conversation.participants.includes(userId)).map((conversation) => ({ id: conversation.id, kind: "club", club: { id: conversation.clubId!, slug: conversation.clubSlug!, name: conversation.title! }, memberCount: conversation.participants.length, isAdmin: conversation.createdBy === userId, lastMessage: messages.get(conversation.id)?.at(-1)?.body ?? "", updatedAt: conversation.updatedAt, unreadCount: 0, muted:Boolean(conversation.mutedParticipants?.has(userId)) }));
  const result = await databasePool.query(`SELECT c.id,c.updated_at,clubs.id club_id,clubs.slug,clubs.name,
    (SELECT COUNT(*)::int FROM conversation_participants WHERE conversation_id=c.id) member_count,
    (me.role='admin') is_admin,(me.muted_until>NOW()) muted,
    COALESCE((SELECT CASE WHEN deleted_at IS NOT NULL THEN 'Mesaj silindi' ELSE body END FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1),'') last_message,
    (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.created_at>COALESCE(me.last_read_at,'epoch')) unread_count
    FROM conversations c JOIN conversation_participants me ON me.conversation_id=c.id AND me.user_id=$1
    JOIN clubs ON clubs.id=c.club_id WHERE c.kind='club' AND clubs.status='Aktiv' ORDER BY c.updated_at DESC`, [userId]);
  return result.rows.map((row) => ({ id: String(row.id), kind: "club", club: { id: String(row.club_id), slug: String(row.slug), name: String(row.name) }, memberCount: Number(row.member_count), isAdmin: Boolean(row.is_admin), lastMessage: String(row.last_message), updatedAt: iso(row.updated_at), unreadCount: Number(row.unread_count), muted:Boolean(row.muted) }));
}

export async function listMessages(conversationId: string, userId: string, before?: string, limit = 40): Promise<Message[]> {
  await assertParticipant(conversationId, userId);
  if (!databasePool) {
    const users = await listUsers(1000);
    const conversation = conversations.get(conversationId);
    const stored = messages.get(conversationId) ?? [];
    const byId = new Map(stored.map((message) => [message.id, message]));
    const peerId = conversation?.kind === "direct" ? conversation.participants.find((id) => id !== userId) : undefined;
    const peerReadAt = peerId ? conversation?.lastReadAt?.get(peerId) : undefined;
    // `before` kursoru (köhnə mesajları yükləmək) SQL rejimindəki kimi işləməlidir.
    const cursorIndex = before ? stored.findIndex((message) => message.id === before) : stored.length;
    const page = cursorIndex < 0 ? [] : stored.slice(0, cursorIndex).slice(-limit);
    return Promise.all(page.map(async (message) => {
      const sender = users.find((user) => user.id === message.senderId);
      const senderName = sender?.name ?? message.senderName;
      return {
        ...message,
        senderName,
        senderInitials: initials(senderName),
        senderAvatarUrl: (await getMedia("avatar", message.senderId))?.secureUrl,
        replyTo: message.replyToId ? buildReplyPreview(byId.get(message.replyToId), users) : undefined,
        reactions: buildMemoryReactions(message.id, userId),
        status: message.senderId === userId && conversation?.kind === "direct"
          ? (peerReadAt && peerReadAt >= message.createdAt ? "read" : "sent")
          : undefined,
      };
    }));
  }
  const values: unknown[] = [conversationId, limit];
  const cursor = before ? "AND (m.created_at,m.id)<(SELECT created_at,id FROM messages WHERE id=$3)" : "";
  if (before) values.push(before);
  const result = await databasePool.query(`SELECT m.*,u.name sender_name,media_assets.secure_url sender_avatar_url,
      r.id reply_id,r.body reply_body,r.deleted_at reply_deleted_at,ru.name reply_sender_name
    FROM messages m JOIN users u ON u.id=m.sender_id
    LEFT JOIN media_assets ON media_assets.owner_type='avatar' AND media_assets.owner_id=u.id::text
    LEFT JOIN messages r ON r.id=m.reply_to_id
    LEFT JOIN users ru ON ru.id=r.sender_id
    WHERE m.conversation_id=$1 ${cursor} ORDER BY m.created_at DESC,m.id DESC LIMIT $2`, values);
  const rows = result.rows.reverse();
  const ids = rows.map((row) => String(row.id));
  const [reactionMap, peerReadAt, kind] = await Promise.all([
    loadReactions(ids, userId),
    directPeerReadAt(conversationId, userId),
    conversationKind(conversationId),
  ]);
  return rows.map((row) => {
    const id = String(row.id);
    const own = String(row.sender_id) === userId;
    return {
      id,
      conversationId: String(row.conversation_id),
      senderId: String(row.sender_id),
      senderName: String(row.sender_name),
      senderInitials: initials(String(row.sender_name)),
      senderAvatarUrl: row.sender_avatar_url ? String(row.sender_avatar_url) : undefined,
      body: row.deleted_at ? "Mesaj silindi" : String(row.body),
      createdAt: iso(row.created_at),
      deleted: Boolean(row.deleted_at),
      editedAt: row.edited_at ? iso(row.edited_at) : undefined,
      replyTo: row.reply_id
        ? { id: String(row.reply_id), senderName: String(row.reply_sender_name ?? "İstifadəçi"), body: row.reply_deleted_at ? "Mesaj silindi" : String(row.reply_body ?? ""), deleted: Boolean(row.reply_deleted_at) }
        : undefined,
      reactions: reactionMap.get(id),
      status: own && kind === "direct" ? (peerReadAt && peerReadAt >= iso(row.created_at) ? "read" : "sent") : undefined,
    };
  });
}

function buildMemoryReactions(messageId: string, userId: string): MessageReaction[] | undefined {
  const map = messageReactions.get(messageId);
  if (!map || map.size === 0) return undefined;
  const counts = new Map<MessageReactionEmoji, number>();
  for (const emoji of map.values()) counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  return [...counts.entries()].map(([emoji, count]) => ({ emoji, count, mine: map.get(userId) === emoji }));
}

function buildReplyPreview(target: Message | undefined, users: { id: string; name: string }[]): ReplyPreview | undefined {
  if (!target) return undefined;
  const sender = users.find((user) => user.id === target.senderId);
  return { id: target.id, senderName: sender?.name ?? target.senderName, body: target.deleted ? "Mesaj silindi" : target.body, deleted: Boolean(target.deleted) };
}

async function loadReactions(messageIds: string[], userId: string): Promise<Map<string, MessageReaction[]>> {
  const map = new Map<string, MessageReaction[]>();
  if (!databasePool || messageIds.length === 0) return map;
  const result = await databasePool.query(
    "SELECT message_id,emoji,COUNT(*)::int count,BOOL_OR(user_id=$2) mine FROM message_reactions WHERE message_id=ANY($1::uuid[]) GROUP BY message_id,emoji ORDER BY count DESC",
    [messageIds, userId],
  );
  for (const row of result.rows) {
    const id = String(row.message_id);
    const list = map.get(id) ?? [];
    list.push({ emoji: String(row.emoji) as MessageReactionEmoji, count: Number(row.count), mine: Boolean(row.mine) });
    map.set(id, list);
  }
  return map;
}

async function directPeerReadAt(conversationId: string, userId: string): Promise<string | undefined> {
  if (!databasePool) return undefined;
  const result = await databasePool.query(
    "SELECT last_read_at FROM conversation_participants WHERE conversation_id=$1 AND user_id<>$2 AND last_read_at IS NOT NULL ORDER BY last_read_at DESC LIMIT 1",
    [conversationId, userId],
  );
  return result.rows[0]?.last_read_at ? iso(result.rows[0].last_read_at) : undefined;
}

async function conversationKind(conversationId: string): Promise<string | undefined> {
  if (!databasePool) return conversations.get(conversationId)?.kind;
  const result = await databasePool.query("SELECT kind FROM conversations WHERE id=$1", [conversationId]);
  return result.rows[0]?.kind ? String(result.rows[0].kind) : undefined;
}

export async function createMessage(conversationId: string, senderId: string, body: string, replyToId?: string): Promise<Message> {
  await assertParticipant(conversationId, senderId);
  const memoryConversation = !databasePool ? conversations.get(conversationId) : null;
  const databaseConversation = databasePool ? await databasePool.query("SELECT kind FROM conversations WHERE id=$1", [conversationId]) : null;
  const kind = memoryConversation?.kind ?? databaseConversation?.rows[0]?.kind;
  if (kind !== "club") {
    const peerId = (await conversationParticipants(conversationId)).find((id) => id !== senderId);
    if (!peerId) throw new ApiError(409, "CONVERSATION_INVALID", "Söhbətin qarşı tərəfi tapılmadı.");
    await assertConnected(senderId, peerId);
  }
  const sender = (await listUsers(1000)).find((user) => user.id === senderId);
  const senderName = sender?.name ?? "İstifadəçi";
  const message: Message = { id: randomUUID(), conversationId, senderId, senderName, senderInitials: initials(senderName),senderAvatarUrl:(await getMedia("avatar",senderId))?.secureUrl, body: body.trim(), createdAt: now(), replyToId, status: kind === "direct" ? "sent" : undefined };
  if (!databasePool) {
    const stored = messages.get(conversationId) ?? [];
    const replyTarget = replyToId ? stored.find((item) => item.id === replyToId) : undefined;
    if (replyToId && !replyTarget) throw new ApiError(422, "REPLY_NOT_FOUND", "Cavab verilən mesaj tapılmadı.");
    messages.set(conversationId, [...stored, message]);
    if (memoryConversation) memoryConversation.updatedAt = message.createdAt;
    return { ...message, replyTo: buildReplyPreview(replyTarget, await listUsers(1000)) };
  }
  if (replyToId) {
    const target = await databasePool.query("SELECT id FROM messages WHERE id=$1 AND conversation_id=$2", [replyToId, conversationId]);
    if (!target.rowCount) throw new ApiError(422, "REPLY_NOT_FOUND", "Cavab verilən mesaj tapılmadı.");
  }
  const result = await databasePool.query("INSERT INTO messages(id,conversation_id,sender_id,body,reply_to_id) VALUES($1,$2,$3,$4,$5) RETURNING *", [message.id, conversationId, senderId, message.body, replyToId ?? null]);
  await databasePool.query("UPDATE conversations SET updated_at=NOW() WHERE id=$1", [conversationId]);
  const created = { ...message, id: String(result.rows[0].id), createdAt: iso(result.rows[0].created_at) };
  if (replyToId) {
    const preview = await databasePool.query("SELECT m.id,m.body,m.deleted_at,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=$1", [replyToId]);
    const row = preview.rows[0];
    if (row) created.replyTo = { id: String(row.id), senderName: String(row.sender_name), body: row.deleted_at ? "Mesaj silindi" : String(row.body), deleted: Boolean(row.deleted_at) };
  }
  return created;
}

export async function editMessage(conversationId: string, messageId: string, userId: string, body: string): Promise<Message | null> {
  await assertParticipant(conversationId, userId);
  const trimmed = body.trim();
  if (!databasePool) {
    const target = (messages.get(conversationId) ?? []).find((item) => item.id === messageId);
    if (!target || target.senderId !== userId || target.deleted) return null;
    target.body = trimmed;
    target.editedAt = now();
    const users = await listUsers(1000);
    return { ...target, reactions: buildMemoryReactions(target.id, userId), replyTo: target.replyToId ? buildReplyPreview((messages.get(conversationId) ?? []).find((item) => item.id === target.replyToId), users) : undefined };
  }
  const result = await databasePool.query(
    "UPDATE messages SET body=$4,edited_at=NOW() WHERE id=$1 AND conversation_id=$2 AND sender_id=$3 AND deleted_at IS NULL RETURNING id",
    [messageId, conversationId, userId, trimmed],
  );
  if (!result.rowCount) return null;
  return (await listMessages(conversationId, userId, undefined, 80)).find((item) => item.id === messageId) ?? null;
}

export async function toggleReaction(conversationId: string, messageId: string, userId: string, emoji: MessageReactionEmoji): Promise<MessageReaction[]> {
  await assertParticipant(conversationId, userId);
  if (!databasePool) {
    const belongs = (messages.get(conversationId) ?? []).some((item) => item.id === messageId);
    if (!belongs) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Mesaj tapılmadı.");
    const map = messageReactions.get(messageId) ?? new Map<string, MessageReactionEmoji>();
    if (map.get(userId) === emoji) map.delete(userId);
    else map.set(userId, emoji);
    messageReactions.set(messageId, map);
    return buildMemoryReactions(messageId, userId) ?? [];
  }
  const belongs = await databasePool.query("SELECT 1 FROM messages WHERE id=$1 AND conversation_id=$2", [messageId, conversationId]);
  if (!belongs.rowCount) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Mesaj tapılmadı.");
  const existing = await databasePool.query("SELECT emoji FROM message_reactions WHERE message_id=$1 AND user_id=$2", [messageId, userId]);
  if (existing.rows[0]?.emoji === emoji) {
    await databasePool.query("DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2", [messageId, userId]);
  } else {
    await databasePool.query(
      "INSERT INTO message_reactions(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji,created_at=NOW()",
      [messageId, userId, emoji],
    );
  }
  return (await loadReactions([messageId], userId)).get(messageId) ?? [];
}

export async function deleteMessage(conversationId: string, messageId: string, userId: string, reason="İstifadəçi tərəfindən silindi"): Promise<boolean> {
  await assertParticipant(conversationId, userId);
  if (!databasePool) {
    const conversationMessages = messages.get(conversationId) ?? [];
    const target = conversationMessages.find((message) => message.id === messageId);
    const conversation = conversations.get(conversationId);
    const canModerate = conversation?.kind === "club" && conversation.createdBy === userId;
    if (!target || (target.senderId !== userId && !canModerate)) return false;
    target.body="Mesaj silindi";target.deleted=true;
    return true;
  }
  const result = await databasePool.query(
    `UPDATE messages m SET body='',deleted_at=NOW(),deleted_by=$3,deletion_reason=$4 FROM conversations c, conversation_participants cp
     WHERE m.id=$1 AND m.conversation_id=$2 AND c.id=m.conversation_id
       AND cp.conversation_id=c.id AND cp.user_id=$3
       AND (m.sender_id=$3 OR (c.kind='club' AND cp.role='admin'))`,
    [messageId, conversationId, userId,reason.slice(0,240)],
  );
  return Boolean(result.rowCount);
}

export async function muteConversation(conversationId:string,userId:string,muted:boolean){await assertParticipant(conversationId,userId);if(!databasePool){const conversation=conversations.get(conversationId);if(!conversation)return;conversation.mutedParticipants??=new Set();if(muted)conversation.mutedParticipants.add(userId);else conversation.mutedParticipants.delete(userId);return;}await databasePool.query("UPDATE conversation_participants SET muted_until=CASE WHEN $3 THEN NOW()+INTERVAL '100 years' ELSE NULL END WHERE conversation_id=$1 AND user_id=$2",[conversationId,userId,muted]);}

export async function reportContent(reporterId:string,input:{entityType:"message"|"profile"|"review"|"club";entityId:string;reason:"abuse"|"threat"|"discrimination"|"spam"|"fake_profile"|"personal_data"|"other";details:string}){const id=randomUUID();if(!databasePool){const createdAt=now();const report:ContentReport={id,reporterId,entityType:input.entityType,entityId:input.entityId,reason:input.reason,details:input.details,status:"open",reviewedBy:null,resolutionNote:"",createdAt,updatedAt:createdAt};reports.set(id,report);return report;}const result=await databasePool.query("INSERT INTO content_reports(id,reporter_id,entity_type,entity_id,reason,details) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[id,reporterId,input.entityType,input.entityId,input.reason,input.details]);return mapReport(result.rows[0]);}

/** Admin şikayət siyahısı üçün: mesajın mətni və göndərəni (id ilə). */
export async function findMessageForReport(messageId: string): Promise<{ body: string; senderId: string; deleted: boolean } | null> {
  if (!databasePool) {
    for (const list of messages.values()) {
      const found = list.find((message) => message.id === messageId);
      if (found) return { body: found.deleted ? "" : found.body, senderId: found.senderId, deleted: Boolean(found.deleted) };
    }
    return null;
  }
  const result = await databasePool.query("SELECT body, sender_id, deleted_at FROM messages WHERE id = $1 LIMIT 1", [messageId]);
  const row = result.rows[0];
  if (!row) return null;
  return { body: row.deleted_at ? "" : String(row.body), senderId: String(row.sender_id), deleted: Boolean(row.deleted_at) };
}

export async function listContentReports(status?:ContentReport["status"]):Promise<ContentReport[]>{if(!databasePool)return [...reports.values()].filter((item)=>!status||item.status===status).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const result=await databasePool.query(`SELECT * FROM content_reports WHERE ($1::text IS NULL OR status=$1) ORDER BY created_at DESC LIMIT 200`,[status??null]);return result.rows.map(mapReport);}

export async function updateContentReport(id:string,reviewerId:string,input:{status:"reviewing"|"resolved"|"dismissed";resolutionNote:string}):Promise<ContentReport|null>{if(!databasePool){const report=reports.get(id);if(!report)return null;report.status=input.status;report.reviewedBy=reviewerId;report.resolutionNote=input.resolutionNote;report.updatedAt=now();return report;}const result=await databasePool.query("UPDATE content_reports SET status=$2,reviewed_by=$3,reviewed_at=NOW(),resolution_note=$4,updated_at=NOW() WHERE id=$1 RETURNING *",[id,input.status,reviewerId,input.resolutionNote]);return result.rows[0]?mapReport(result.rows[0]):null;}

function mapReport(row:Record<string,unknown>):ContentReport{return{id:String(row.id),reporterId:String(row.reporter_id),entityType:row.entity_type as ContentReport["entityType"],entityId:String(row.entity_id),reason:String(row.reason),details:String(row.details??""),status:row.status as ContentReport["status"],reviewedBy:row.reviewed_by?String(row.reviewed_by):null,resolutionNote:String(row.resolution_note??""),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)};}

export async function markRead(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
  if (!databasePool) {
    const conversation = conversations.get(conversationId);
    if (conversation) { conversation.lastReadAt ??= new Map(); conversation.lastReadAt.set(userId, now()); }
    return;
  }
  await databasePool.query("UPDATE conversation_participants SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2", [conversationId, userId]);
}

export async function conversationParticipants(conversationId: string) {
  if (!databasePool) return conversations.get(conversationId)?.participants ?? [];
  const result = await databasePool.query("SELECT user_id FROM conversation_participants WHERE conversation_id=$1", [conversationId]);
  return result.rows.map((row) => String(row.user_id));
}

async function assertConnected(first: string, second: string) {
  if (!databasePool) {
    if (![...connections.values()].some((connection) => connection.status === "accepted" && pairMatches(connection, first, second))) throw new ApiError(403, "CONNECTION_REQUIRED", "Mesaj üçün əlaqə qəbul edilməlidir.");
    return;
  }
  const result = await databasePool.query("SELECT 1 FROM connections WHERE status='accepted' AND ((requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1))", [first, second]);
  if (!result.rowCount) throw new ApiError(403, "CONNECTION_REQUIRED", "Mesaj üçün əlaqə qəbul edilməlidir.");
}

async function assertParticipant(conversationId: string, userId: string) {
  if (!databasePool) {
    if (!conversations.get(conversationId)?.participants.includes(userId)) throw new ApiError(403, "CONVERSATION_FORBIDDEN", "Bu söhbətə giriş yoxdur.");
    return;
  }
  const result = await databasePool.query("SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2", [conversationId, userId]);
  if (!result.rowCount) throw new ApiError(403, "CONVERSATION_FORBIDDEN", "Bu söhbətə giriş yoxdur.");
}

function mapConnection(row: Record<string, unknown>): Connection {
  return { id: String(row.id), requesterId: String(row.requester_id), recipientId: String(row.recipient_id), status: row.status as Connection["status"], createdAt: iso(row.created_at) };
}

function pairMatches(connection: Connection, first: string, second: string) {
  return (connection.requesterId === first && connection.recipientId === second) || (connection.requesterId === second && connection.recipientId === first);
}

function toCommunityUser(user: { id: string; name: string; role: string; faculty: string; program: string; city: string }): CommunityUser {
  return { id: user.id, name: user.name, role: user.role, faculty: user.faculty, program: user.program, city: user.city };
}
