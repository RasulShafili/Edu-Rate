"use client";

import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Mail,
  Smartphone,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  canonicalUniversity,
  faculties,
  getProgramsForFaculty,
  isFacultyName,
  isValidFacultyProgram,
  type FacultyName,
} from "../data/academic-programs";
import { useT } from "../i18n/LanguageProvider";
import { ApiError } from "../lib/api/client";
import {
  isAuthProviderUnavailable,
  useAuth,
} from "./AuthProvider";
import { PasswordStrength, passwordProblemKey } from "./PasswordStrength";
import { EmailCodeStep } from "./EmailCodeStep";
import type { EmailChallenge, EmailCodeResult } from "../data/user";

type AuthMode = "login" | "register";
type AccountType = "student" | "teacher";
type AuthField = "name" | "email" | "password" | "university" | "faculty" | "program" | "accountType" | "legalAccepted";
/** Xətalar tərcümə açarı kimi saxlanır — dil dəyişəndə də düzgün göstərilir. */
type Message = { key: string; values?: Record<string, string | number> };
type FieldErrors = Partial<Record<AuthField, Message>>;

type AuthFormValues = Record<AuthField, string>;

/* Giriş səhifəsi tamamilə sakitdir: istifadəçinin istəyi ilə bütün animasiyalar
   götürülüb — sonsuz üzən zərrəciklər, panel açılışı, tab-lar arası sürüşmə və
   layout keçidləri. Forma dərhal, sabit görünür (həm də daha sürətli). */

type AuthExperienceProps = {
  initialMode?: AuthMode;
  returnTo?: string;
};

export function AuthExperience({ initialMode = "login", returnTo = "/profile" }: AuthExperienceProps) {
  const t = useT();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<Message | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyName | "">("");
  const [selectedProgram, setSelectedProgram] = useState("");
  // Razılıq qutusu işarələnməyənə qədər qeydiyyat düyməsi aktiv olmur.
  const [legalChecked, setLegalChecked] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [pendingTeacherEmail, setPendingTeacherEmail] = useState("");
  const [pendingTeacherDelivery, setPendingTeacherDelivery] = useState(false);
  const [drafts, setDrafts] = useState({ name: "", email: "", password: "" });
  /** Şifrə düzgündür, 2FA kodu gözlənilir. */
  const [challenge, setChallenge] = useState("");
  /** Şifrədən və ya qeydiyyatdan sonra e-poçta 6 rəqəmli kod göndərildi. */
  const [emailStep, setEmailStep] = useState<{ data: EmailChallenge; purpose: "login" | "signup"; email: string } | null>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const formId = useId();
  const router = useRouter();
  const {
    credentialAuthAvailable,
    completeTwoFactor,
    register,
    signIn,
    status,
  } = useAuth();
  const submitting = status === "submitting";
  const visibleMessage: Message | null = formMessage ?? (credentialAuthAvailable ? null : { key: "auth.unavailable" });

  function showMessage(message: Message | null, isError = false) {
    setFormMessage(message);
    setMessageIsError(isError);
  }

  function selectMode(nextMode: AuthMode) {
    if (nextMode === mode || submitting) return;
    setMode(nextMode);
    setErrors({});
    showMessage(null);
    setShowPassword(false);
    setSelectedFaculty("");
    setSelectedProgram("");
    setAccountType("student");
    setPendingTeacherEmail("");
    setDrafts({ name: "", email: "", password: "" });
    setChallenge("");
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextMode: AuthMode | null = null;

    if (event.key === "ArrowLeft" || event.key === "Home") nextMode = "login";
    if (event.key === "ArrowRight" || event.key === "End") nextMode = "register";
    if (!nextMode) return;

    event.preventDefault();
    selectMode(nextMode);
    document.getElementById(`${formId}-${nextMode}-tab`)?.focus();
  }

  function handleFormChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    const field = target.name as AuthField;
    if (!isAuthField(field)) return;
    if (field === "name" || field === "email" || field === "password") {
      setDrafts((current) => ({ ...current, [field]: target.value }));
    }

    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (formMessage) showMessage(null);
  }

  function describeError(error: unknown, fallback: string): { message: Message; fields: FieldErrors } {
    if (isAuthProviderUnavailable(error)) return { message: { key: "auth.unavailable" }, fields: {} };
    if (!(error instanceof ApiError)) return { message: { key: fallback }, fields: {} };
    const details = (error.details && typeof error.details === "object" ? error.details : {}) as Record<string, unknown>;
    switch (error.code) {
      case "INVALID_CREDENTIALS":
        return { message: { key: "auth.error.invalidCredentials" }, fields: {} };
      case "ACCOUNT_RESTRICTED":
        return { message: { key: "auth.error.restricted" }, fields: {} };
      case "ACCOUNT_THROTTLED": {
        const seconds = Number(details.retryAfter) || 900;
        return { message: { key: "auth.error.throttled", values: { count: Math.ceil(seconds / 60) } }, fields: {} };
      }
      case "RATE_LIMITED":
        return { message: { key: "auth.error.rateLimited" }, fields: {} };
      case "RESEND_TOO_SOON":
        return { message: { key: "auth.error.codeTooSoon", values: { count: Number(details.retryAfter) || 60 } }, fields: {} };
      case "EMAIL_EXISTS":
        return { message: { key: "auth.error.emailExists" }, fields: { email: { key: "auth.error.emailExists" } } };
      case "WEAK_PASSWORD": {
        const key = `password.problem.${String(details.reason ?? "common")}`;
        return { message: { key }, fields: { password: { key } } };
      }
      case "INVALID_ACADEMIC_SELECTION":
      case "INVALID_UNIVERSITY":
        return { message: { key: "auth.error.program" }, fields: { program: { key: "auth.error.program" } } };
      case "TWO_FACTOR_INVALID":
        return { message: { key: "auth.twoFactor.invalid" }, fields: {} };
      case "CHALLENGE_EXPIRED":
        return { message: { key: "auth.twoFactor.expired" }, fields: {} };
      case "EMAIL_DELIVERY_UNAVAILABLE":
        return { message: { key: "auth.error.emailDelivery" }, fields: {} };
      default:
        return { message: { key: fallback }, fields: {} };
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !credentialAuthAvailable) return;

    const form = event.currentTarget;
    const values = readFormValues(new FormData(form));
    const nextErrors = validateAuthForm(mode, values);

    setErrors(nextErrors);
    showMessage(null);

    const firstInvalidField = Object.keys(nextErrors)[0] as AuthField | undefined;
    if (firstInvalidField) {
      (form.elements.namedItem(firstInvalidField) as HTMLElement | null)?.focus();
      return;
    }

    try {
      if (mode === "login") {
        const result = await signIn({ email: values.email, password: values.password });
        if (result.emailChallenge) {
          setEmailStep({ data: result.emailChallenge, purpose: "login", email: values.email });
          return;
        }
        if (!result.user) {
          setChallenge(result.twoFactorChallenge);
          setUseRecoveryCode(false);
          return;
        }
        showMessage({ key: "auth.signedIn" });
        form.reset();
        router.push(getRoleHome(result.user.accessRole, returnTo));
      } else {
        const result = await register({
          name: values.name,
          email: values.email,
          password: values.password,
          university: values.university,
          faculty: values.accountType === "student" ? values.faculty : "Müəllim heyəti",
          program: values.program,
          accountType: values.accountType as AccountType,
          legalAccepted: true,
        });
        // Hesab yaradıldı, amma e-poçt kodla təsdiqlənməyincə açılmır.
        if (result.emailChallenge) {
          setEmailStep({ data: result.emailChallenge, purpose: "signup", email: values.email });
          setSelectedFaculty("");
          setSelectedProgram("");
          return;
        }
        if (result.requiresApproval) {
          setPendingTeacherEmail(values.email);
          setPendingTeacherDelivery(Boolean(result.emailDeliveryPending));
          form.reset();
          setSelectedFaculty("");
          setSelectedProgram("");
          return;
        }
        if (result.requiresEmailVerification) {
          showMessage({ key: result.emailDeliveryPending ? "auth.verifyDeliveryPending" : "auth.verifySent" });
          form.reset();
          return;
        }
        showMessage({ key: "auth.created" });
        form.reset();
        // Yeni tələbə boş profil əvəzinə ilk addımlar səhifəsinə düşür.
        const role = result.user?.accessRole;
        const isStudent = !role || role === "student";
        router.push(isStudent && returnTo === "/profile" ? "/welcome" : getRoleHome(role, returnTo));
      }

      setSelectedFaculty("");
      setSelectedProgram("");
    } catch (error) {
      const { message, fields } = describeError(error, mode === "login" ? "auth.error.loginFailed" : "auth.error.signupFailed");
      if (Object.keys(fields).length > 0) {
        setErrors((current) => ({ ...current, ...fields }));
        const firstErrorField = Object.keys(fields)[0] as AuthField;
        (form.elements.namedItem(firstErrorField) as HTMLElement | null)?.focus();
      }
      showMessage(message, true);
    }
  }

  async function handleTwoFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    if (!code) {
      showMessage({ key: useRecoveryCode ? "auth.twoFactor.recoveryRequired" : "auth.twoFactor.codeRequired" }, true);
      return;
    }
    showMessage(null);
    try {
      const result = await completeTwoFactor(challenge, code);
      if (result.recoveryCodeUsed) {
        // Qalan bərpa kodlarının sayı Parametrlərdə görünür.
        router.push("/settings#two-factor");
        return;
      }
      router.push(getRoleHome(result.user.accessRole, returnTo));
    } catch (error) {
      const { message } = describeError(error, "auth.error.loginFailed");
      if (error instanceof ApiError && (error.code === "CHALLENGE_EXPIRED" || error.code === "ACCOUNT_THROTTLED")) setChallenge("");
      showMessage(message, true);
    }
  }

  function handleEmailVerified(result: EmailCodeResult) {
    const step = emailStep;
    setEmailStep(null);
    if (!result.user) {
      // Müəllim: e-poçt təsdiqləndi, indi rəhbərlik təsdiqi gözlənilir.
      setMode("register");
      setPendingTeacherEmail(step?.email ?? "");
      setPendingTeacherDelivery(false);
      return;
    }
    const role = result.user.accessRole;
    if (step?.purpose === "signup") {
      const isStudent = !role || role === "student";
      router.push(isStudent && returnTo === "/profile" ? "/welcome" : getRoleHome(role, returnTo));
      return;
    }
    router.push(getRoleHome(role, returnTo));
  }

  function handleEmailRestart(key: string, values?: Record<string, string | number>) {
    setEmailStep(null);
    showMessage(key ? { key, values } : null, Boolean(key));
  }

  const heading = emailStep ? t(emailStep.purpose === "signup" ? "auth.emailCode.titleSignup" : "auth.emailCode.title") : challenge ? t("auth.twoFactor.title") : mode === "login" ? t("auth.signInTitle") : t("auth.signUpTitle");
  const description = emailStep
    ? t("auth.emailCode.text")
    : challenge
    ? t(useRecoveryCode ? "auth.twoFactor.recoveryText" : "auth.twoFactor.text")
    : mode === "login" ? t("auth.signInHint") : t("auth.signUpHint");
  const errorText = (field: AuthField) => errors[field] ? t(errors[field].key, errors[field].values) : undefined;

  return (
    <section className="auth-section" aria-labelledby="auth-title">
      <div className={`auth-layout auth-layout-${mode}`}>
        <aside className="auth-story" aria-label={t("auth.story.aria")}>
          <div>
            <span className="auth-kicker"><Sparkles size={13} aria-hidden="true" /> {t("auth.story.kicker")}</span>
            <h2>{t("auth.story.title1")}<br /><em>{t("auth.story.title2")}</em></h2>
            <p>{t("auth.story.text")}</p>
          </div>
          <div className="auth-story-note">
            <span><i /> {t("auth.story.noteTitle")}</span>
            <p>{t("auth.story.noteText")}</p>
          </div>
          <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
          <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
        </aside>

        <div className="auth-panel">
          <header className="auth-panel-heading">
            <span>{t("auth.accountLabel")}</span>
            <h1 id="auth-title">{heading}</h1>
            <p>{description}</p>
          </header>

          {emailStep ? (
            <EmailCodeStep challenge={emailStep.data} purpose={emailStep.purpose} onVerified={handleEmailVerified} onRestart={handleEmailRestart} />
          ) : challenge ? (
            <form method="post" className="auth-form auth-form-login auth-two-factor" noValidate aria-busy={submitting} onSubmit={handleTwoFactorSubmit}>
              <AuthFieldShell
                id={`${formId}-code`}
                label={t(useRecoveryCode ? "auth.twoFactor.recoveryLabel" : "auth.twoFactor.codeLabel")}
                icon={useRecoveryCode ? <KeyRound size={16} aria-hidden="true" /> : <Smartphone size={16} aria-hidden="true" />}
              >
                <input
                  key={useRecoveryCode ? "recovery" : "totp"}
                  id={`${formId}-code`}
                  name="code"
                  type="text"
                  inputMode={useRecoveryCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  pattern={useRecoveryCode ? undefined : "[0-9]{6}"}
                  maxLength={useRecoveryCode ? 11 : 6}
                  placeholder={useRecoveryCode ? "xxxxx-xxxxx" : "000000"}
                  disabled={submitting}
                  autoFocus
                  required
                />
              </AuthFieldShell>
              <div className="auth-form-footer">
                <button type="button" className="auth-forgot-link auth-link-button" onClick={() => { setUseRecoveryCode((value) => !value); showMessage(null); }} disabled={submitting}>
                  {t(useRecoveryCode ? "auth.twoFactor.useApp" : "auth.twoFactor.useRecovery")}
                </button>
                <button type="submit" className="auth-submit" disabled={submitting}>
                  <span>{submitting ? t("auth.checking") : t("auth.twoFactor.submit")}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className="auth-forgot-link auth-link-button" onClick={() => { setChallenge(""); showMessage(null); }} disabled={submitting}>
                  {t("auth.twoFactor.back")}
                </button>
              </div>
              <p className={`auth-form-message${visibleMessage ? " is-visible" : ""}`} role={messageIsError ? "alert" : "status"} aria-live="polite">
                {visibleMessage ? t(visibleMessage.key, visibleMessage.values) : ""}
              </p>
            </form>
          ) : (
          <>
          <div className="auth-mode-tabs" role="tablist" aria-label={t("auth.tabsAria")}>
            {(["login", "register"] as const).map((tabMode) => {
              const active = mode === tabMode;
              const label = tabMode === "login" ? t("auth.tabSignIn") : t("auth.tabSignUp");

              return (
                <button
                  key={tabMode}
                  id={`${formId}-${tabMode}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${formId}-${tabMode}-panel`}
                  tabIndex={active ? 0 : -1}
                  disabled={submitting}
                  onClick={() => selectMode(tabMode)}
                  onKeyDown={handleTabKeyDown}
                >
                  {active && <i className="auth-mode-pill" />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div
            key={mode}
            id={`${formId}-${mode}-panel`}
            className="auth-form-panel"
            role="tabpanel"
            aria-labelledby={`${formId}-${mode}-tab`}
          >
              {mode === "register" && pendingTeacherEmail ? (
                <section className="auth-registration-receipt" aria-live="polite">
                  <span className="auth-registration-check"><Check size={26} aria-hidden="true" /></span>
                  <div>
                    <span>{t("auth.teacherReceipt.kicker")}</span>
                    <h2>{t("auth.teacherReceipt.title")}</h2>
                    <p>{t("auth.teacherReceipt.text", { email: pendingTeacherEmail })} {pendingTeacherDelivery ? `${t("auth.teacherReceipt.deliveryPending")} ` : ""}{t("auth.teacherReceipt.approval")}</p>
                  </div>
                  <button type="button" className="auth-submit" onClick={() => selectMode("login")}>
                    <span>{t("auth.teacherReceipt.toSignIn")}</span><ArrowRight size={16} aria-hidden="true" />
                  </button>
                </section>
              ) : <form
                // JavaScript hələ yüklənməyibsə brauzer formanı özü göndərir; `method`
                // olmasa bu GET olur və e-poçt ilə parol URL-ə (tarixçə, jurnallar) düşür.
                method="post"
                className={`auth-form auth-form-${mode}`}
                noValidate
                aria-busy={submitting}
                onChange={handleFormChange}
                onSubmit={handleSubmit}
              >
                {mode === "register" && (
                  <fieldset className="auth-account-type">
                    <legend>{t("auth.roleQuestion")}</legend>
                    <input type="hidden" name="accountType" value={accountType} />
                    <div role="radiogroup" aria-label={t("auth.roleGroupAria")}>
                      {([
                        { value: "student", label: t("auth.roleStudent"), description: t("auth.roleStudentHint"), icon: GraduationCap },
                        { value: "teacher", label: t("auth.roleTeacher"), description: t("auth.roleTeacherHint"), icon: BriefcaseBusiness },
                      ] as const).map((option) => {
                        const Icon = option.icon;
                        return <button key={option.value} type="button" role="radio" aria-checked={accountType === option.value} onClick={() => { setAccountType(option.value); setSelectedFaculty(""); setSelectedProgram(""); }} disabled={submitting}><Icon size={17} /><span><strong>{option.label}</strong><small>{option.description}</small></span></button>;
                      })}
                    </div>
                  </fieldset>
                )}

                {mode === "register" && (
                  <AuthFieldShell
                    id={`${formId}-name`}
                    label={t("auth.name")}
                    error={errorText("name")}
                    icon={<UserRound size={16} aria-hidden="true" />}
                  >
                    <input
                      id={`${formId}-name`}
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder={t("auth.namePlaceholder")}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                      disabled={!credentialAuthAvailable || submitting}
                      required
                    />
                  </AuthFieldShell>
                )}

                <AuthFieldShell
                  id={`${formId}-email`}
                  label={t("auth.email")}
                  error={errorText("email")}
                  icon={<Mail size={16} aria-hidden="true" />}
                >
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete={mode === "login" ? "username" : "email"}
                    placeholder="ad.soyad@universitet.az"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    disabled={!credentialAuthAvailable || submitting}
                    required
                  />
                </AuthFieldShell>

                <AuthFieldShell
                  id={`${formId}-password`}
                  label={t("auth.password")}
                  error={errorText("password")}
                  icon={<LockKeyhole size={16} aria-hidden="true" />}
                  after={mode === "register" ? (
                    <PasswordStrength id={`${formId}-password-strength`} password={drafts.password} email={drafts.email} name={drafts.name} />
                  ) : null}
                  action={(
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      aria-pressed={showPassword}
                      disabled={!credentialAuthAvailable || submitting}
                    >
                      {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  )}
                >
                  <input
                    id={`${formId}-password`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "login" ? t("auth.passwordPlaceholder") : t("auth.newPasswordPlaceholder")}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={[errors.password ? `${formId}-password-error` : "", mode === "register" ? `${formId}-password-strength` : ""].filter(Boolean).join(" ") || undefined}
                    disabled={!credentialAuthAvailable || submitting}
                    required
                  />
                </AuthFieldShell>

                {mode === "register" && (
                  <>
                    <AuthFieldShell
                      id={`${formId}-university`}
                      label={t("auth.university")}
                      error={errorText("university")}
                      icon={<Building2 size={16} aria-hidden="true" />}
                    >
                      <input
                        id={`${formId}-university`}
                        name="university"
                        type="text"
                        autoComplete="organization"
                        value={canonicalUniversity}
                        readOnly
                        aria-readonly="true"
                        aria-invalid={Boolean(errors.university)}
                        aria-describedby={errors.university ? `${formId}-university-error` : undefined}
                        disabled={!credentialAuthAvailable || submitting}
                        required
                      />
                    </AuthFieldShell>

                    {accountType === "student" && <AuthFieldShell
                        id={`${formId}-faculty`}
                        label={t("auth.faculty")}
                        error={errorText("faculty")}
                        icon={<GraduationCap size={16} aria-hidden="true" />}
                      >
                        <select id={`${formId}-faculty`} name="faculty" autoComplete="organization-title" value={selectedFaculty} onChange={(event) => { const faculty = event.target.value; setSelectedFaculty(isFacultyName(faculty) ? faculty : ""); setSelectedProgram(""); }} aria-invalid={Boolean(errors.faculty)} aria-describedby={errors.faculty ? `${formId}-faculty-error` : undefined} disabled={!credentialAuthAvailable || submitting} required>
                          <option value="" disabled>{t("auth.pickFaculty")}</option>
                          {faculties.map((faculty) => <option key={faculty} value={faculty}>{faculty}</option>)}
                        </select>
                      </AuthFieldShell>}

                    <AuthFieldShell
                      id={`${formId}-program`}
                      label={accountType === "student" ? t("auth.program") : t("auth.teachingArea")}
                      error={errorText("program")}
                      icon={<BookOpen size={16} aria-hidden="true" />}
                    >
                      {accountType === "student" ? <select
                        id={`${formId}-program`}
                        name="program"
                        value={selectedProgram}
                        onChange={(event) => setSelectedProgram(event.target.value)}
                        aria-invalid={Boolean(errors.program)}
                        aria-describedby={errors.program ? `${formId}-program-error` : undefined}
                        disabled={!credentialAuthAvailable || submitting || !selectedFaculty}
                        required
                      >
                        <option value="" disabled>
                          {selectedFaculty ? t("auth.pickProgram") : t("auth.pickFacultyFirst")}
                        </option>
                        {getProgramsForFaculty(selectedFaculty).map((program) => (
                          <option key={program} value={program}>{program}</option>
                        ))}
                      </select> : <input id={`${formId}-program`} name="program" type="text" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)} placeholder={t("auth.teachingPlaceholder")} aria-invalid={Boolean(errors.program)} aria-describedby={errors.program ? `${formId}-program-error` : undefined} disabled={!credentialAuthAvailable || submitting} required />}
                    </AuthFieldShell>
                  </>
                )}

                <div className="auth-form-footer">
                  {mode === "login" && (
                    <a className="auth-forgot-link" href="/auth/recovery">{t("auth.forgot")}</a>
                  )}
                  {mode === "register" ? (
                    <>
                      <label className="auth-privacy-note auth-legal-consent">
                        <input
                          type="checkbox"
                          name="legalAccepted"
                          value="true"
                          checked={legalChecked}
                          onChange={(event) => setLegalChecked(event.target.checked)}
                          aria-invalid={Boolean(errors.legalAccepted)}
                          aria-describedby={errors.legalAccepted ? `${formId}-legalAccepted-error` : undefined}
                          required
                        />
                        <span>{t("auth.legal.prefix")}<a href="/privacy" target="_blank" rel="noopener">{t("auth.legal.privacy")}</a>{t("auth.legal.comma")}<a href="/terms" target="_blank" rel="noopener">{t("auth.legal.terms")}</a>{t("auth.legal.and")}<a href="/community-guidelines" target="_blank" rel="noopener">{t("auth.legal.guidelines")}</a>{t("auth.legal.suffix")}</span>
                      </label>
                      {errors.legalAccepted && (
                        <span id={`${formId}-legalAccepted-error`} className="auth-field-error auth-legal-error">
                          {errorText("legalAccepted")}
                        </span>
                      )}
                    </>
                  ) : null}
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={submitting || !credentialAuthAvailable || (mode === "register" && !legalChecked)}
                    title={mode === "register" && !legalChecked ? t("auth.error.legal") : undefined}
                  >
                    <span>
                      {submitting
                        ? t("auth.checking")
                        : !credentialAuthAvailable
                          ? t("auth.disabledSubmit")
                          : mode === "login"
                            ? t("auth.submitSignIn")
                            : t("auth.submitSignUp")}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>

                <p
                  className={`auth-form-message${visibleMessage ? " is-visible" : ""}`}
                  role={messageIsError ? "alert" : "status"}
                  aria-live="polite"
                >
                  {visibleMessage ? t(visibleMessage.key, visibleMessage.values) : ""}
                </p>
                <p className="auth-legal-links">{t("auth.disclaimer")}</p>
              </form>}
          </div>
          </>
          )}
        </div>
      </div>
    </section>
  );
}

type AuthFieldShellProps = {
  id: string;
  label: string;
  error?: string;
  icon: ReactNode;
  action?: ReactNode;
  /** Sahənin altında, xətadan sonra (məs. şifrə gücü göstəricisi). */
  after?: ReactNode;
  children: ReactNode;
};

function AuthFieldShell({ id, label, error, icon, action, after, children }: AuthFieldShellProps) {
  return (
    <div className={`auth-field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-shell">
        <span className="auth-field-icon">{icon}</span>
        {children}
        {action}
      </div>
      {error && <span id={`${id}-error`} className="auth-field-error">{error}</span>}
      {after}
    </div>
  );
}

function readFormValues(formData: FormData): AuthFormValues {
  return {
    name: getFormValue(formData, "name"),
    email: getFormValue(formData, "email"),
    // Əvvəldən kəsilir: mövcud hesabların şifrəsi də qeydiyyatda belə saxlanıb.
    password: getFormValue(formData, "password"),
    university: getFormValue(formData, "university"),
    faculty: getFormValue(formData, "faculty"),
    program: getFormValue(formData, "program"),
    accountType: getFormValue(formData, "accountType") || "student",
    legalAccepted: getFormValue(formData, "legalAccepted"),
  };
}

function getFormValue(formData: FormData, field: AuthField): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateAuthForm(mode: AuthMode, values: AuthFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (mode === "register" && values.name.length < 2) errors.name = { key: "auth.error.name" };
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = { key: "auth.error.email" };
  if (mode === "login") {
    if (!values.password) errors.password = { key: "auth.error.passwordRequired" };
  } else {
    // Qeydiyyatda backend ilə eyni siyasət (eyni fayl).
    const problem = passwordProblemKey(values.password, { email: values.email, name: values.name });
    if (problem) errors.password = { key: problem };
  }
  if (mode === "register" && values.university !== canonicalUniversity) {
    errors.university = { key: "auth.error.university" };
  }
  if (mode === "register" && values.accountType === "student" && !isFacultyName(values.faculty)) {
    errors.faculty = { key: "auth.error.faculty" };
  }
  if (mode === "register" && values.accountType === "student" && !isValidFacultyProgram(values.faculty, values.program)) {
    errors.program = { key: "auth.error.program" };
  }
  if (mode === "register" && values.accountType !== "student" && values.program.length < 2) {
    errors.program = { key: "auth.error.teachingArea" };
  }
  if (mode === "register" && values.legalAccepted !== "true") {
    errors.legalAccepted = { key: "auth.error.legal" };
  }

  return errors;
}

function isAuthField(value: string): value is AuthField {
  return ["name", "email", "password", "university", "faculty", "program", "accountType", "legalAccepted"].includes(value);
}

function getRoleHome(role: string | undefined, fallback: string) {
  if (role === "owner_admin" || role === "admin" || role === "assistant_admin") return "/admin";
  if (role === "teacher" || role === "mentor") return "/workspace";
  return fallback;
}
