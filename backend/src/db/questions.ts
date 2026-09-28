import { randomUUID } from "node:crypto";
import { databasePool } from "./database.js";

export const QUESTION_TOPICS = ["kampus", "tedris", "yasayis", "texniki", "diger"] as const;
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export type Answer = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export type Question = {
  id: string;
  title: string;
  body: string;
  topic: QuestionTopic;
  createdAt: string;
  voteCount: number;
  answerCount: number;
  voted: boolean;
  mine: boolean;
  answers?: Answer[];
};

type MemoryQuestion = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  topic: QuestionTopic;
  createdAt: string;
  votes: Set<string>;
  answers: Array<{ id: string; authorId: string; body: string; createdAt: string }>;
};

const memory = new Map<string, MemoryQuestion>();
const now = () => new Date().toISOString();
const iso = (value: unknown) => new Date(String(value)).toISOString();

/**
 * Suallar ANONİM göstərilir: müəllif adı heç vaxt qaytarılmır, yalnız
 * "mine" bayrağı ilə istifadəçi öz sualını tanıyır. Müəllif id-si bazada
 * moderasiya üçün saxlanılır.
 */
export async function listQuestions(viewerId: string | null, sort: "new" | "top" = "new"): Promise<Question[]> {
  if (!databasePool) {
    const items = [...memory.values()].map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      topic: item.topic,
      createdAt: item.createdAt,
      voteCount: item.votes.size,
      answerCount: item.answers.length,
      voted: Boolean(viewerId && item.votes.has(viewerId)),
      mine: Boolean(viewerId && item.authorId === viewerId),
    }));
    return sort === "top"
      ? items.sort((a, b) => b.voteCount - a.voteCount || b.createdAt.localeCompare(a.createdAt))
      : items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const order = sort === "top" ? "vote_count DESC, q.created_at DESC" : "q.created_at DESC";
  const result = await databasePool.query(
    `SELECT q.id,q.title,q.body,q.topic,q.created_at,q.author_id,
       (SELECT COUNT(*)::int FROM campus_question_votes v WHERE v.question_id=q.id) AS vote_count,
       (SELECT COUNT(*)::int FROM campus_answers a WHERE a.question_id=q.id AND a.status='published') AS answer_count,
       EXISTS(SELECT 1 FROM campus_question_votes v WHERE v.question_id=q.id AND v.user_id=$1) AS voted
     FROM campus_questions q
     WHERE q.status='published'
     ORDER BY ${order}
     LIMIT 100`,
    [viewerId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: String(row.body ?? ""),
    topic: String(row.topic) as QuestionTopic,
    createdAt: iso(row.created_at),
    voteCount: Number(row.vote_count),
    answerCount: Number(row.answer_count),
    voted: Boolean(row.voted),
    mine: Boolean(viewerId && row.author_id && String(row.author_id) === viewerId),
  }));
}

export async function listAnswers(questionId: string, viewerId: string | null): Promise<Answer[]> {
  if (!databasePool) {
    const question = memory.get(questionId);
    if (!question) return [];
    return question.answers.map((answer) => ({
      id: answer.id,
      body: answer.body,
      createdAt: answer.createdAt,
      mine: Boolean(viewerId && answer.authorId === viewerId),
    }));
  }
  // Gizlədilmiş sualın cavabları da gizli qalmalıdır — əvvəl id ilə oxunurdu.
  const result = await databasePool.query(
    `SELECT a.id,a.body,a.created_at,a.author_id
     FROM campus_answers a
     JOIN campus_questions q ON q.id=a.question_id AND q.status='published'
     WHERE a.question_id=$1 AND a.status='published'
     ORDER BY a.created_at`,
    [questionId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    body: String(row.body),
    createdAt: iso(row.created_at),
    mine: Boolean(viewerId && row.author_id && String(row.author_id) === viewerId),
  }));
}

export async function createQuestion(authorId: string, input: { title: string; body: string; topic: QuestionTopic }) {
  const id = randomUUID();
  if (!databasePool) {
    memory.set(id, { id, authorId, title: input.title, body: input.body, topic: input.topic, createdAt: now(), votes: new Set(), answers: [] });
    return { id };
  }
  await databasePool.query(
    "INSERT INTO campus_questions(id,author_id,title,body,topic) VALUES($1,$2,$3,$4,$5)",
    [id, authorId, input.title, input.body, input.topic],
  );
  return { id };
}

export async function createAnswer(questionId: string, authorId: string, body: string) {
  if (!databasePool) {
    const question = memory.get(questionId);
    if (!question) return null;
    const answer = { id: randomUUID(), authorId, body, createdAt: now() };
    question.answers.push(answer);
    return { id: answer.id, questionAuthorId: question.authorId, questionTitle: question.title };
  }
  const exists = await databasePool.query("SELECT author_id,title FROM campus_questions WHERE id=$1 AND status='published'", [questionId]);
  if (!exists.rowCount) return null;
  const id = randomUUID();
  await databasePool.query("INSERT INTO campus_answers(id,question_id,author_id,body) VALUES($1,$2,$3,$4)", [id, questionId, authorId, body]);
  return { id, questionAuthorId: String(exists.rows[0].author_id), questionTitle: String(exists.rows[0].title) };
}

/** Səsi çevirir: verilmişdisə geri alır, yoxdursa əlavə edir. */
export async function toggleVote(questionId: string, userId: string) {
  if (!databasePool) {
    const question = memory.get(questionId);
    if (!question) return null;
    if (question.votes.has(userId)) question.votes.delete(userId);
    else question.votes.add(userId);
    return { voted: question.votes.has(userId), voteCount: question.votes.size };
  }
  // `createAnswer` kimi yalnız dərc olunmuş suala: gizlədilmiş suala səs getmirdi
  // yalnız yaddaş rejimində (orada sual silinir), bazada isə gedirdi.
  const exists = await databasePool.query("SELECT 1 FROM campus_questions WHERE id=$1 AND status='published'", [questionId]);
  if (!exists.rowCount) return null;
  const removed = await databasePool.query("DELETE FROM campus_question_votes WHERE question_id=$1 AND user_id=$2", [questionId, userId]);
  if (!removed.rowCount) {
    await databasePool.query("INSERT INTO campus_question_votes(question_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [questionId, userId]);
  }
  const count = await databasePool.query("SELECT COUNT(*)::int AS count FROM campus_question_votes WHERE question_id=$1", [questionId]);
  return { voted: !removed.rowCount, voteCount: Number(count.rows[0]?.count ?? 0) };
}

/** Müəllif öz sualını silə bilər; admin hər sualı gizlədə bilər. */
export async function hideQuestion(questionId: string, userId: string, isModerator: boolean) {
  if (!databasePool) {
    const question = memory.get(questionId);
    if (!question || (!isModerator && question.authorId !== userId)) return false;
    memory.delete(questionId);
    return true;
  }
  const result = isModerator
    ? await databasePool.query("UPDATE campus_questions SET status='hidden',updated_at=NOW() WHERE id=$1", [questionId])
    : await databasePool.query("UPDATE campus_questions SET status='hidden',updated_at=NOW() WHERE id=$1 AND author_id=$2", [questionId, userId]);
  return Boolean(result.rowCount);
}

/**
 * Müəllif öz cavabını, moderator istənilən cavabı gizlədə bilər. Əvvəl bunun
 * üçün heç bir yol yox idi: anonim bölmədə təhqiramiz cavabı nə yazan, nə də
 * moderator silə bilirdi (`campus_answers.status` sütunu isə hazır idi).
 */
export async function hideAnswer(questionId: string, answerId: string, userId: string, isModerator: boolean) {
  if (!databasePool) {
    const question = memory.get(questionId);
    const index = question ? question.answers.findIndex((item) => item.id === answerId) : -1;
    const target = question?.answers[index];
    if (!question || !target) return false;
    if (!isModerator && target.authorId !== userId) return false;
    question.answers.splice(index, 1);
    return true;
  }
  const result = isModerator
    ? await databasePool.query(
      "UPDATE campus_answers SET status='hidden' WHERE id=$1 AND question_id=$2 AND status='published'",
      [answerId, questionId],
    )
    : await databasePool.query(
      "UPDATE campus_answers SET status='hidden' WHERE id=$1 AND question_id=$2 AND author_id=$3 AND status='published'",
      [answerId, questionId, userId],
    );
  return Boolean(result.rowCount);
}

/** Profil "kampus izi" üçün: istifadəçinin verdiyi sual və yazdığı cavab sayı. */
export async function countUserContributions(userId: string) {
  if (!databasePool) {
    const questions = [...memory.values()];
    return {
      questions: questions.filter((item) => item.authorId === userId).length,
      answers: questions.reduce((sum, item) => sum + item.answers.filter((a) => a.authorId === userId).length, 0),
    };
  }
  const result = await databasePool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM campus_questions WHERE author_id=$1 AND status='published') AS questions,
       (SELECT COUNT(*)::int FROM campus_answers WHERE author_id=$1 AND status='published') AS answers`,
    [userId],
  );
  return { questions: Number(result.rows[0]?.questions ?? 0), answers: Number(result.rows[0]?.answers ?? 0) };
}
