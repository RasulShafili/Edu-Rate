"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Database, Layers3, LockKeyhole, Network, Sparkles } from "lucide-react";
import {
  leadershipScript,
  plannedApiContracts,
  presentationChecklist,
  presentationModules,
  presentationQuestions,
  presentationStack,
  readinessNotes,
  reviewCriteria,
} from "../data/technical-presentation";

const ease = [0.22, 1, 0.36, 1] as const;

export function TechnicalPresentation() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="technical-presentation" aria-labelledby="technical-presentation-title">
      <div className="technical-presentation-grid" aria-hidden="true" />
      <motion.div
        className="technical-presentation-hero"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
      >
        <span className="technical-kicker"><Sparkles size={15} /> 09 / Texniki təqdimat</span>
        <h1 id="technical-presentation-title" className="module-page-title">
          Rəhbərlərə aydın <em>texniki hekayə.</em>
        </h1>
        <p>
          Bu səhifə EduRate-i görüşdə sakit, biznes yönümlü və texniki cəhətdən dürüst izah etmək üçün hazırlanıb.
          Kod detalına girmədən platformanın məqsədini, hazır vəziyyətini və növbəti addımlarını göstərir.
        </p>
      </motion.div>

      <motion.div
        className="technical-question-panel"
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.62, ease }}
      >
        {presentationQuestions.map((question, index) => (
          <article key={question}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{question}</p>
          </article>
        ))}
      </motion.div>

      <div className="technical-section-layout">
        <motion.article
          className="technical-narrative-card is-wide"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.62, ease }}
        >
          <span className="technical-kicker"><Layers3 size={14} /> Layihənin məqsədi</span>
          <h2>EduRate nədir?</h2>
          <p>
            EduRate Azərbaycan dilli universitet platformasıdır. Tələbələr dərs cədvəlini qura, elanları izləyə,
            tədbirlərə yazıla, klublara qoşula, icmada ünsiyyət qura, anonim sual verə və dəstək sorğusu göndərə bilir.
          </p>
          <ul className="technical-chip-list">
            {presentationModules.map((module) => <li key={module}>{module}</li>)}
          </ul>
        </motion.article>

        <motion.article
          className="technical-narrative-card"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.62, delay: 0.04, ease }}
        >
          <span className="technical-kicker"><Network size={14} /> Frontend arxitekturası</span>
          <h2>Modullu və genişlənə bilən quruluş.</h2>
          <div className="technical-stack-list">
            {presentationStack.map((item) => (
              <section key={item.label}>
                <strong>{item.label}</strong>
                <h3>{item.value}</h3>
                <p>{item.detail}</p>
              </section>
            ))}
          </div>
        </motion.article>

        <motion.article
          className="technical-narrative-card"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.62, delay: 0.08, ease }}
        >
          <span className="technical-kicker"><Database size={14} /> REST API hazırlığı</span>
          <h2>Backend qoşulması üçün hazır müqavilə.</h2>
          <p>
            Frontend-də vahid API client, service layer və SWR əsaslı hook-lar var. Node.js + Express servisi
            canlı işləyir; əsas istifadəçi əməliyyatları və idarəetmə məlumatları PostgreSQL-də qalıcı saxlanılır.
          </p>
          <ul className="technical-api-list">
            {plannedApiContracts.map((contract) => <li key={contract}>{contract}</li>)}
          </ul>
        </motion.article>

        <motion.article
          className="technical-narrative-card is-accent"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.62, ease }}
        >
          <span className="technical-kicker"><LockKeyhole size={14} /> Təhlükəsizlik və moderasiya</span>
          <h2>Etibarlı sessiya, təsdiqlənmiş məzmun və rol nəzarəti.</h2>
          <p>
            Platformada girişlər e-poçt kodu və 2FA ilə qorunur, tələbələrin göndərdiyi elan, paylaşım və klub
            müraciətləri admin moderasiyasından keçir, şikayətlər isə əməliyyat mərkəzində izlənir.
          </p>
          <ul className="technical-chip-list">
            {reviewCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
          </ul>
        </motion.article>
      </div>

      <section className="technical-readiness" aria-labelledby="technical-readiness-title">
        <div>
          <span className="technical-kicker">Hazır vəziyyət</span>
          <h2 id="technical-readiness-title">Nə hazırdır, nə növbəti mərhələdir?</h2>
        </div>
        <div className="technical-readiness-grid">
          {readinessNotes.map((note) => (
            <motion.article
              key={note.label}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.52, ease }}
            >
              <span>{note.status}</span>
              <h3>{note.label}</h3>
              <p>{note.detail}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="technical-script-panel" aria-labelledby="technical-script-title">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.64, ease }}
        >
          <span className="technical-kicker">Rəhbərlərə deyiləcək qısa mətn</span>
          <h2 id="technical-script-title">Danışıq skripti</h2>
          <p>{leadershipScript}</p>
        </motion.div>
        <motion.ul
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.64, delay: 0.05, ease }}
        >
          {presentationChecklist.map((item) => (
            <li key={item}><Check size={16} /> {item}</li>
          ))}
        </motion.ul>
      </section>

      <a className="technical-next-link" href="/admin">
        Admin paneli göstər <ArrowUpRight size={16} />
      </a>
    </section>
  );
}
