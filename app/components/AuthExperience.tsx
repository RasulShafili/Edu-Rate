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
  LockKeyhole,
  Mail,
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
import { ApiError } from "../lib/api/client";
import {
  isAuthProviderUnavailable,
  useAuth,
} from "./AuthProvider";

type AuthMode = "login" | "register";
type AccountType = "student" | "teacher";
type AuthField = "name" | "email" | "password" | "university" | "faculty" | "program" | "accountType" | "legalAccepted";
type FieldErrors = Partial<Record<AuthField, string>>;

type AuthFormValues = Record<AuthField, string>;

/* Giriş səhifəsi tamamilə sakitdir: istifadəçinin istəyi ilə bütün animasiyalar
   götürülüb — sonsuz üzən zərrəciklər, panel açılışı, tab-lar arası sürüşmə və
   layout keçidləri. Forma dərhal, sabit görünür (həm də daha sürətli). */

type AuthExperienceProps = {
  initialMode?: AuthMode;
  returnTo?: string;
};

export function AuthExperience({ initialMode = "login", returnTo = "/profile" }: AuthExperienceProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyName | "">("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [pendingTeacherEmail, setPendingTeacherEmail] = useState("");
  const [pendingTeacherDelivery, setPendingTeacherDelivery] = useState(false);
  const formId = useId();
  const router = useRouter();
  const {
    credentialAuthAvailable,
    register,
    signIn,
    status,
  } = useAuth();
  const submitting = status === "submitting";
  const unavailableMessage = "Təhlükəsiz giriş xidməti hazırda əlçatan deyil. Bir qədər sonra yenidən yoxla.";
  const visibleMessage = formMessage || (
    credentialAuthAvailable ? "" : unavailableMessage
  );

  function selectMode(nextMode: AuthMode) {
    if (nextMode === mode || submitting) return;
    setMode(nextMode);
    setErrors({});
    setFormMessage("");
    setShowPassword(false);
    setSelectedFaculty("");
    setSelectedProgram("");
    setAccountType("student");
    setPendingTeacherEmail("");
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

    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (formMessage) setFormMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !credentialAuthAvailable) return;

    const form = event.currentTarget;
    const values = readFormValues(new FormData(form));
    const nextErrors = validateAuthForm(mode, values);

    setErrors(nextErrors);
    setFormMessage("");

    const firstInvalidField = Object.keys(nextErrors)[0] as AuthField | undefined;
    if (firstInvalidField) {
      (form.elements.namedItem(firstInvalidField) as HTMLElement | null)?.focus();
      return;
    }

    try {
      if (mode === "login") {
        const nextUser = await signIn({ email: values.email, password: values.password });
        setFormMessage("Daxil oldun. Profilin açılır.");
        form.reset();
        router.push(getRoleHome(nextUser.accessRole, returnTo));
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
        if (result.requiresApproval) {
          setPendingTeacherEmail(values.email);
          setPendingTeacherDelivery(Boolean(result.emailDeliveryPending));
          form.reset();
          setSelectedFaculty("");
          setSelectedProgram("");
          return;
        }
        if(result.requiresEmailVerification){setFormMessage(result.emailDeliveryPending?"Hesab yaradıldı, lakin məktub xidməti hazırda cavab vermir. Giriş bölməsindən təsdiq məktubunu yenidən istəyə bilərsən.":"Təsdiq keçidi e-poçt ünvanına göndərildi. Məktubdakı keçidi aç.");form.reset();return;}
        setFormMessage("Hazırsan — hesabın yaradıldı.");
        form.reset();
        // Yeni tələbə boş profil əvəzinə ilk addımlar səhifəsinə düşür.
        const role = result.user?.accessRole;
        const isStudent = !role || role === "student";
        router.push(isStudent && returnTo === "/profile" ? "/welcome" : getRoleHome(role, returnTo));
      }

      setSelectedFaculty("");
      setSelectedProgram("");
    } catch (error) {
      if (isAuthProviderUnavailable(error)) {
        setFormMessage(unavailableMessage);
      } else if (error instanceof ApiError) {
        const fieldErrors = readApiFieldErrors(error);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors((current) => ({ ...current, ...fieldErrors }));
          const firstErrorField = Object.keys(fieldErrors)[0] as AuthField;
          (form.elements.namedItem(firstErrorField) as HTMLElement | null)?.focus();
        }
        setFormMessage(error.message);
      } else if (error instanceof Error && error.message) {
        setFormMessage(error.message);
      } else {
        setFormMessage(
          mode === "login"
            ? "Giriş məlumatlarını yoxla və yenidən cəhd et."
            : "Hesabı yaratmaq mümkün olmadı. Məlumatlarını yoxlayıb yenidən cəhd et.",
        );
      }
    }
  }

  const panelHeading = mode === "login"
    ? <>Hesabına daxil ol</>
    : <>Yeni hesab yarat</>;
  const panelDescription = mode === "login"
    ? "E-poçt ünvanını və şifrəni daxil et."
    : "Hesab növünü seç, sonra əsas məlumatlarını tamamla.";

  return (
    <section className="auth-section" aria-labelledby="auth-title">
      <div className={`auth-layout auth-layout-${mode}`}>
        <aside className="auth-story" aria-label="EduRate universitet şəbəkəsi">
          <div>
            <span className="auth-kicker"><Sparkles size={13} aria-hidden="true" /> Universitet şəbəkən</span>
            <h2>Bir giriş.<br /><em>Bütün tələbə həyatın.</em></h2>
            <p>
              Etibarlı elanları izləmək, doğru insanlarla tanış olmaq və inkişaf yolunu
              bir yerdə saxlamaq üçün düşünülmüş sakit məkan.
            </p>
          </div>
          <div className="auth-story-note">
            <span><i /> Aktiv şəbəkə</span>
            <p>Diqqətini yayındırmayan, universitet həyatına uyğun şəxsi təcrübə.</p>
          </div>
          <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
          <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
        </aside>

        <div className="auth-panel">
          <header className="auth-panel-heading">
            <span>EduRate hesabı</span>
            <h1 id="auth-title">{panelHeading}</h1>
            <p>{panelDescription}</p>
          </header>

          <div className="auth-mode-tabs" role="tablist" aria-label="Hesab əməliyyatı">
            {(["login", "register"] as const).map((tabMode) => {
              const active = mode === tabMode;
              const label = tabMode === "login" ? "Daxil ol" : "Qeydiyyatdan keç";

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
                    <span>Müəllim qeydiyyatı tamamlandı</span>
                    <h2>Müraciətin təsdiq gözləyir.</h2>
                    <p><strong>{pendingTeacherEmail}</strong> ünvanı ilə hesab yaradıldı. {pendingTeacherDelivery ? "Təsdiq məktubu xidməti hazırda cavab vermir; bir qədər sonra məktubu yenidən istə. " : ""}Rəhbərlik müəllim statusunu təsdiqlədikdən və e-poçt təsdiqindən sonra daxil ola biləcəksən.</p>
                  </div>
                  <button type="button" className="auth-submit" onClick={() => selectMode("login")}>
                    <span>Daxil ol bölməsinə keç</span><ArrowRight size={16} aria-hidden="true" />
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
                    <legend>Kim kimi qeydiyyatdan keçirsən?</legend>
                    <input type="hidden" name="accountType" value={accountType} />
                    <div role="radiogroup" aria-label="Hesab növünü seç">
                      {([
                        { value: "student", label: "Tələbə", description: "Fakültə və ixtisasını seç", icon: GraduationCap },
                        { value: "teacher", label: "Müəllim", description: "Tədris sahəni qeyd et", icon: BriefcaseBusiness },
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
                    label="Ad və soyad"
                    error={errors.name}
                    icon={<UserRound size={16} aria-hidden="true" />}
                  >
                    <input
                      id={`${formId}-name`}
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Adını və soyadını yaz"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                      disabled={!credentialAuthAvailable || submitting}
                      required
                    />
                  </AuthFieldShell>
                )}

                <AuthFieldShell
                  id={`${formId}-email`}
                  label="E-poçt ünvanı"
                  error={errors.email}
                  icon={<Mail size={16} aria-hidden="true" />}
                >
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="ad.soyad@universitet.az"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    disabled={!credentialAuthAvailable || submitting}
                    required
                  />
                </AuthFieldShell>

                <AuthFieldShell
                  id={`${formId}-password`}
                  label="Şifrə"
                  error={errors.password}
                  icon={<LockKeyhole size={16} aria-hidden="true" />}
                  action={(
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
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
                    placeholder="Ən azı 8 simvol"
                    minLength={8}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? `${formId}-password-error` : undefined}
                    disabled={!credentialAuthAvailable || submitting}
                    required
                  />
                </AuthFieldShell>

                {mode === "register" && (
                  <>
                    <AuthFieldShell
                      id={`${formId}-university`}
                      label="Universitet"
                      error={errors.university}
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
                        label="Fakültə"
                        error={errors.faculty}
                        icon={<GraduationCap size={16} aria-hidden="true" />}
                      >
                        <select id={`${formId}-faculty`} name="faculty" autoComplete="organization-title" value={selectedFaculty} onChange={(event) => { const faculty = event.target.value; setSelectedFaculty(isFacultyName(faculty) ? faculty : ""); setSelectedProgram(""); }} aria-invalid={Boolean(errors.faculty)} aria-describedby={errors.faculty ? `${formId}-faculty-error` : undefined} disabled={!credentialAuthAvailable || submitting} required>
                          <option value="" disabled>Fakültəni seç</option>
                          {faculties.map((faculty) => <option key={faculty} value={faculty}>{faculty}</option>)}
                        </select>
                      </AuthFieldShell>}

                    <AuthFieldShell
                      id={`${formId}-program`}
                      label={accountType === "student" ? "İxtisas" : "Tədris sahəsi"}
                      error={errors.program}
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
                          {selectedFaculty ? "İxtisası seç" : "Əvvəl fakültəni seç"}
                        </option>
                        {getProgramsForFaculty(selectedFaculty).map((program) => (
                          <option key={program} value={program}>{program}</option>
                        ))}
                      </select> : <input id={`${formId}-program`} name="program" type="text" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)} placeholder="Məsələn, Riyaziyyat" aria-invalid={Boolean(errors.program)} aria-describedby={errors.program ? `${formId}-program-error` : undefined} disabled={!credentialAuthAvailable || submitting} required />}
                    </AuthFieldShell>
                  </>
                )}

                <div className="auth-form-footer">
                  {mode === "login" && (
                    <a className="auth-forgot-link" href="/auth/recovery">Şifrəni unutmusansa, bərpa et</a>
                  )}
                  {mode === "register" ? (
                    <>
                      <label className="auth-privacy-note auth-legal-consent">
                        <input
                          type="checkbox"
                          name="legalAccepted"
                          value="true"
                          aria-invalid={Boolean(errors.legalAccepted)}
                          aria-describedby={errors.legalAccepted ? `${formId}-legalAccepted-error` : undefined}
                          required
                        />
                        <span><a href="/terms" target="_blank">İstifadə şərtlərini</a> və <a href="/privacy" target="_blank">məxfilik siyasətini</a> oxudum və qəbul edirəm.</span>
                      </label>
                      {errors.legalAccepted && (
                        <span id={`${formId}-legalAccepted-error`} className="auth-field-error auth-legal-error">
                          {errors.legalAccepted}
                        </span>
                      )}
                    </>
                  ) : null}
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={submitting || !credentialAuthAvailable}
                  >
                    <span>
                      {submitting
                        ? "Yoxlanılır…"
                        : !credentialAuthAvailable
                          ? "E-poçt girişi aktiv deyil"
                          : mode === "login"
                            ? "Daxil ol"
                            : "Hesab yarat"}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>

                <p
                  className={`auth-form-message${visibleMessage ? " is-visible" : ""}`}
                  role={formMessage.includes("mümkün olmadı") || formMessage.includes("yoxla") ? "alert" : "status"}
                  aria-live="polite"
                >
                  {visibleMessage}
                </p>
                <p className="auth-legal-links">EduRate müstəqil tələbə pilotudur və universitetin rəsmi informasiya sistemi deyil.</p>
              </form>}
          </div>
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
  children: ReactNode;
};

function AuthFieldShell({ id, label, error, icon, action, children }: AuthFieldShellProps) {
  return (
    <div className={`auth-field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-shell">
        <span className="auth-field-icon">{icon}</span>
        {children}
        {action}
      </div>
      {error && <span id={`${id}-error`} className="auth-field-error">{error}</span>}
    </div>
  );
}

function readFormValues(formData: FormData): AuthFormValues {
  return {
    name: getFormValue(formData, "name"),
    email: getFormValue(formData, "email"),
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

  if (mode === "register" && values.name.length < 2) errors.name = "Ad və soyadını yaz.";
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Düzgün e-poçt ünvanı yaz.";
  if (values.password.length < 8) {
    errors.password = "Şifrə ən azı 8 simvol olmalıdır.";
  } else if (values.password.length > 72) {
    errors.password = "Şifrə ən çox 72 simvol ola bilər.";
  } else if (!/[a-zA-ZƏəÖöÜüĞğŞşÇçİı]/.test(values.password)) {
    errors.password = "Şifrədə ən azı bir hərf olmalıdır.";
  } else if (!/\d/.test(values.password)) {
    errors.password = "Şifrədə ən azı bir rəqəm olmalıdır.";
  }
  if (mode === "register" && values.university !== canonicalUniversity) {
    errors.university = "Universitet olaraq Qarabağ Universitetini seç.";
  }
  if (mode === "register" && values.accountType === "student" && !isFacultyName(values.faculty)) {
    errors.faculty = "Fakültəni siyahıdan seç.";
  }
  if (mode === "register" && values.accountType === "student" && !isValidFacultyProgram(values.faculty, values.program)) {
    errors.program = "İxtisası seçilmiş fakültənin siyahısından seç.";
  }
  if (mode === "register" && values.accountType !== "student" && values.program.length < 2) {
    errors.program = values.accountType === "teacher" ? "Tədris sahəsini yaz." : "İxtisası seç.";
  }
  if (mode === "register" && values.legalAccepted !== "true") {
    errors.legalAccepted = "Davam etmək üçün istifadə şərtlərini və məxfilik siyasətini qəbul et.";
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

function readApiFieldErrors(error: ApiError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const details = error.details;

  if (details && typeof details === "object" && !Array.isArray(details)) {
    Object.entries(details).forEach(([field, message]) => {
      if (isAuthField(field) && typeof message === "string") {
        fieldErrors[field] = message;
      }
    });
  }

  if (error.code === "EMAIL_EXISTS") {
    fieldErrors.email = "Bu e-poçtla artıq hesab yaradılıb. Daxil ol bölməsindən istifadə et.";
  }

  return fieldErrors;
}
