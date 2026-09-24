"use client";

import { useT } from "../i18n/LanguageProvider";
import { findPasswordProblem, scorePassword } from "../lib/password-policy";

type PasswordStrengthProps = {
  id: string;
  password: string;
  email?: string;
  name?: string;
};

/**
 * Yeni şifrə sahəsinin altındakı göstərici. Qaydalar backend ilə eyni fayldan
 * gəlir (`app/lib/password-policy.ts`), yəni burada "keçir" deyilən şifrəni
 * server də qəbul edir.
 */
export function PasswordStrength({ id, password, email, name }: PasswordStrengthProps) {
  const t = useT();
  const context = { email, name };
  const problem = password ? findPasswordProblem(password, context) : null;
  const score = scorePassword(password, context);

  return (
    <div id={id} className={`password-strength is-score-${score}`} aria-live="polite">
      <div className="password-strength__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => <span key={level} className={score >= level ? "is-on" : ""} />)}
      </div>
      <p>
        {!password
          ? t("password.hint")
          : problem
            ? t(`password.problem.${problem}`)
            : t(`password.strength.${score}`)}
      </p>
    </div>
  );
}

export function passwordProblemKey(password: string, context: { email?: string; name?: string } = {}) {
  const problem = findPasswordProblem(password, context);
  return problem ? `password.problem.${problem}` : null;
}
