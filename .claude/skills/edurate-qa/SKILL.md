---
name: edurate-qa
description: Verification discipline for the EduRate section-by-section QA. Read before starting a section; covers how to separate real defects from test-environment artefacts, how to trace a request end to end before calling it broken, how to confirm a push actually deployed, and the editing traps that have already cost time. Use when doing QA, bug-hunting or fixing on the EduRate codebase.
---

# EduRate QA — səhvlərdən çıxarılan qaydalar

Bu fayl bölmə nəticələri üçün deyil (onlar plan faylındadır) — **üsul** üçündür.
Hər QA sessiyasının əvvəlində oxu, sonunda yeni dərs varsa əlavə et.
Tutulmuş yanlış diaqnoz da dərsdir: dəyərli olan tutma üsuludur.

---

## 1. Təsdiqləmədən səhv elan etmə

Bu, ən bahalı səhv növüdür, çünki yanlış yeri "düzəltməyə" aparır.

**Baş verdi:** `TeacherEvaluation.tsx` yalnız `POST /api/reviews/validate`
çağırırdı, `POST /api/reviews` isə komponentdə görünmürdü. "Rəylər saxlanmır"
qənaətinə gəldim. **Yanlış idi** — BFF-in `validate` marşrutu sorğunu backend-in
`POST /api/reviews`-inə ötürür. Adı yanıldıcıdır, davranışı düzgündür.

**Qayda:** zənciri sonuna qədər izlə — **komponent → `app/api/**/route.ts` (BFF)
→ `backend/src/routes/*.ts`**. EduRate-də frontend heç vaxt backend-ə birbaşa
getmir; aradakı BFF marşrutunun adı çox vaxt əməliyyatı əks etdirmir.

**Sonra:** iddianı işlədərək təsdiqlə. Məsələn rəyin saxlandığını `POST` edib
sonra `GET /api/reviews/mine` ilə geri oxuyaraq gördüm.

---

## 2. Brauzer paneli yalançı siqnal verir

### 2.1 Animasiya donur (iki dəfə tələyə düşdüm)

Panel arxa planda olanda `requestAnimationFrame` dayanır. Framer Motion-un
çıxış animasiyası bitmir, ona görə **forma "Saxlanılır…" vəziyyətində ilişmiş
görünür**, halbuki əməliyyat uğurlu olub.

**Qayda:** animasiyadan asılı hər müşahidədən sonra **real toxunuş** et
(`hover` və ya `click`) və yenidən yoxla. Yalnız bundan sonra nəticə çıxar.

### 2.2 Konsol buferi köhnə mesajları saxlayır

`console.clear()` panelin öz buferini sıfırlamır. Düzəlişdən sonra xəta hələ də
görünə bilər — halbuki artıq yoxdur.

**Qayda:** hidrasiya və ilk-render xətalarını **yeni tabda** yoxla
(`tabs_create` → `navigate` → `read_console_messages`). Yeni tabın buferi boşdur.
Təkrarlanan əməliyyat xətalarını isə sayğacla ölç:

```js
window.__errors = 0;
addEventListener('error', e => { if (/axtarilan metn/i.test(e.message||'')) window.__errors++; });
// ... əməliyyatı təkrarla, sonra window.__errors oxu
```

### 2.3 Sürətli ardıcıl kliklər React-də itir

Dörd meyarı `forEach` ilə bir anda kliklədim; yalnız sonuncusu qeydə düşdü,
çünki hər `onChange` köhnə `value` proposunu oxuyurdu. Real istifadəçidə belə
olmur.

**Qayda:** vəziyyət dəyişən kliklər arasında `await new Promise(r=>setTimeout(r,350))`.

---

## 3. Mənbə koduna yox, hesablanmış üsluba bax

**Baş verdi:** `StudentFeed`-də `bg-[#0b0b0c]` gördüm və "səhifə qaradır"
qənaətinə gəldim. CSS onu üstələyirdi — səhifə açıq temada idi.
**Amma** eyni komponentdəki mətn rəngləri üstələnmirdi və həqiqətən görünmürdü.

**Qayda:** rəng iddiasını `getComputedStyle` ilə yoxla və kontrastı **rəqəmlə**
ölç. Ekran görüntüsü görünməyən mətni göstərmir — ona görə də görünmür.

```js
function bgOf(el){let n=el;while(n){const c=getComputedStyle(n).backgroundColor;
  if(c&&c!=='rgba(0, 0, 0, 0)')return c;n=n.parentElement;}return 'rgb(255,255,255)';}
// fg-ni bg ilə qarışdır (alfa!), sonra WCAG nisbətini hesabla; AA = 4.5:1
```

Tapılan nümunələr: `1.02:1`, `1.03:1` — yəni ağ fonda ağ. Köhnə tünd temadan
qalan `rgba(244,243,237,…)` rəngləri bu saytda həmişə şübhəlidir.

---

## 4. Əvvəlcə əhatəni müəyyən et

**Baş verdi:** `/teachers`-dəki hidrasiya xətasının səbəbini axtararkən rəqəm
formatlayıcılarını, semestr funksiyasını, konfeti siyahısını yoxladım — hamısı
təmiz. Vaxt itdi.

**Düzgün ilk addım:** başqa səhifədə də var? `/clubs` təmiz çıxdı → problem
`/teachers`-ə xasdır → axtarış sahəsi dərhal daraldı.

**Sonra:** Next.js-in dev örtüyü dəqiq fərqi verir:

```js
const root=document.querySelector('nextjs-portal').shadowRoot;
root.querySelector('pre.nextjs__container_errors__component-stack').textContent
```

Bu, `+`/`-` işarələri ilə serverlə brauzerin fərqini göstərir və birbaşa
komponentin adını verir.

---

## 5. Bu kod bazasının məlum tələləri

| Tələ | Nəticə | Düzgün nümunə |
|---|---|---|
| `typeof document === "undefined" ? null : createPortal(...)` | Serverdə `null`, brauzerin **ilk** render-ində portal → hidrasiya uyğunsuzluğu, React bütün ağacı yenidən qurur | `mounted` bayrağı: `useState(false)` + `useEffect(()=>setMounted(true),[])`, sonra `if(!mounted) return null` |
| Render zamanı `new Date()` | Server UTC, istifadəçi UTC+4 → axşamlar fərqli gün; üstəlik hidrasiya uyğunsuzluğu | Tarixi `useState<Date|null>(null)` + `useEffect` ilə yalnız brauzerdə hesabla |
| `Intl.DateTimeFormat("az-AZ", {month:"long"})` | Bəzi Chromium qurğularında "M09 19, Sat" verir; Node düzgün verir → iki tərəf fərqlənir | Ay və gün adlarını lüğətdən götür (`month.*`, `schedule.day.*`) |
| `zodObject.refine(...).partial()` | Zod runtime-da atır → endpoint 500 | Sahələri ayrı saxla; `refine` yalnız yaratma sxeminə |
| `.partial()` + sahədə `default()` | Hissəvi PATCH digər sahələri **silir** | Default-lar yalnız yaratma sxemində |
| Çox kadrlı `scale: [1, 1.2, 1]` + `type:"spring"` | Motion rədd edir, animasiya heç oynamır və xəta atır | Çox kadr üçün `tween` (`duration` + `ease`) |
| `overflow: hidden` | Qutu hələ də sürüşəndir; fokus onu sürüşdürüb məzmunu kəsir | `overflow: clip` |
| `catch {}` və ya `catch(() => null)` | Server nasazlığı "boş siyahı" / "tapılmadı" kimi göstərilir | Üç hal ayır: `ok` / `missing` / `error` |

---

## 6. Xəta yollarını məcbur et

Səhvlərin yarısı **uğursuzluq halındadır** və normal istifadədə görünmür.
Brauzerdə `window.fetch`-i müvəqqəti əvəz et:

```js
window.__realFetch = window.__realFetch || window.fetch;
window.fetch = function(i, init){
  const u = typeof i === 'string' ? i : i?.url ?? '';
  if ((init?.method||'').toUpperCase() === 'PATCH' && u.includes('/state'))
    return Promise.resolve(new Response('{}', {status: 401}));
  return window.__realFetch.apply(this, arguments);
};
```

Bununla tapıldı: səssiz silinmə xətası, səssiz "oxundu" xətası, 401-də sonsuza
qədər "işləməyən" düymə, yüklənmə xətasının "boşdur" kimi göstərilməsi.

**Hər əməliyyat üçün soruş:** uğursuz olsa istifadəçi *nə görür*? Heç nə
görürsə, bu səhvdir.

---

## 7. Rol matrisini API səviyyəsində yoxla

İnterfeys düyməni gizlədə bilər, backend isə açıq qala bilər — və əksinə.
Hər ikisini ayrıca yoxla:

```bash
for pair in "telebe:$ST" "muellim:$TT" "admin:$AT"; do
  R="${pair%%:*}"; T="${pair#*:}"
  printf "  %-9s -> " "$R"
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/..." \
    -H "Authorization: Bearer $T" -H 'Origin: http://localhost:3000'
done
```

`Origin` başlığı vacibdir (CSRF). Rol **tokendən yox, bazadan** oxunur
(`authenticate.ts`), ona görə token saxtalaşdırmaqla rol qaldırmaq mümkün deyil.

Tapılan uyğunsuzluqlar bu yolla gəldi: müəllim bütün formanı görüb 403 alırdı;
`owner_admin` klub silə bilmirdi, adi `admin` isə bilirdi.

---

## 8. Push ≠ deploy

**Baş verdi:** commit GitHub-a getdi, sayt köhnə qaldı. Vercel commit-in müəllif
e-poçtuna görə deployment-i rədd etmişdi. Mənim yaddaşımdakı qayda səhv idi və
səhvin özünə səbəb oldu.

**Qayda:**
- Edu-Rate-də müəllif e-poçtunu **dəyişdirmə** — reponun öz `user.email`-i düzgündür.
- Push-dan sonra **canlı saytdan marker yoxla**, gözləmə ilə kifayətlənmə:

```bash
curl -s https://edu-rate-nu.vercel.app/<yol> | grep -c '<yeni-class-ve-ya-metn>'
```

- Vercel **commit-in bütün ağacını** deploy edir, fərqini yox. Ona görə bir
  uğurlu deployment ondan əvvəlki rədd edilmiş commit-lərin işini özü ilə aparır
  — iş deploy olunmuş kimi görünür. Bu, səhvin uzun müddət gizli qalmasının səbəbidir.

---

## 9. Lokal məlumat ≠ canlı məlumat

Seed elanlarının müddəti bitmişdi, ona görə lövhə boş görünürdü. Səhv sanmadan
əvvəl production-u yoxladım: orada 3 aktiv elan var idi.

**Qayda:** "boş / yoxdur" tipli tapıntıda canlı API-ni yoxla:
`curl -s https://edurate-api.onrender.com/api/<yol>`.

**Mühit təhlükəsizliyi:** kökdə `.env.local` olmalıdır —
`EDURATE_API_BASE_URL=http://localhost:3001`. Olmasa `remote-credential.ts`
default olaraq **canlı Render API-yə** gedir və test məlumatı real bazaya düşür.
Test başlamazdan əvvəl hər iki tərəfin eyni nəticəni qaytardığını təsdiqlə.

---

## 10. Redaktə üsulu

### Atomik yamaq skriptləri
Çoxsaylı `replace` əməliyyatını **əvvəlcə yoxla, sonra yaz**: hər hansı biri
tapılmasa `SystemExit` at və fayla **heç nə yazma**. Belədə uğursuz yamaq faylı
yarımçıq qoymur.

```python
for old, new in pairs:
    n = s.count(old)
    if n != 1:
        raise SystemExit("%d defe:\n%s" % (n, old[:170]))
    s = s.replace(old, new)
io.open(path, "w", encoding="utf-8", newline="\n").write(s)  # yalnız sonda
```

### Skript faylı yaz, heredoc yox
Uzun Python `<<'PY'` heredoc-ları apostrof və dırnaq üzündən **iki dəfə** bash
parse xətası verdi. Uzun skripti `Write` ilə fayla yaz, sonra işə sal.

### Dəqiq lövbər seç
- `"useT" not in s` yoxlaması **`useTransform`-a görə** yanlış işlədi və import
  əlavə olunmadı. Alt-sətir yox, **import yolunu** yoxla: `"i18n/LanguageProvider" not in s`.
- Ümumi regex hook-u **yanlış funksiyaya** saldı və generik tipi parçaladı.
  Lövbər hədəf komponentin daxilində **unikal** olmalıdır (məsələn
  `}: AdminRecordFormSheetProps) {`), ümumi nümunə yox.

### Hər addımdan sonra
`npx tsc --noEmit` — ucuzdur və səhvi dərhal göstərir.

---

## 11. Tərcümə: yarımçıq qalmasın

Müqayisə səhifəsində bir neçə açarı bağlayıb qalanını sonraya saxladım —
nəticədə səhifə **qarışıq dildə** çıxdı ("0/3 chosen" + azərbaycanca qalan mətn).
Bu, tamamilə tərcümə olunmamış səhifədən pisdir.

**Qayda:** bir görünüşün tərcüməsi **ya tam, ya heç**. Ayrıca:
- Etiket xəritələrini (`criteriaLabels`, `kindPresentation`) **açar** daşıyan
  hala gətir, istifadə yerində `t()` ilə aç.
- İnterfeysin **özünün qurduğu** mətn də tərcümə olunmalıdır ("11 il təcrübə",
  ekran oxuyucu etiketləri, tarix sətirləri).
- **Baza məlumatı tərcümə olunmur:** klub adı, müəllim adı, şəhər, fənn adı,
  elan mətni. Bu, qəsdəndir.
- Açar əlavə edib komponenti bağlamamaq mümkündür — `rating.*` açarları üç dildə
  hazır idi, komponent isə onları heç işlətmirdi. Açar sayı ilə kifayətlənmə,
  nəticəni brauzerdə dildən-dilə keçərək yoxla.

---

## 12. Sessiyanın gedişi

1. **Mühit:** `git status` təmiz? `.env.local` və `backend/.env` yerindədir?
   Serverlər qalxıb? Lokal backend-ə baxdığını təsdiqlə.
2. **Oxu:** komponent → BFF marşrutu → backend marşrutu → DB qatı. Rol
   qaydalarını yaz.
3. **Rol matrisi:** curl ilə hər rol üçün əsas əməliyyat.
4. **İnterfeys:** hər rolda gözlə yoxla — düymə görünür, amma işləyirmi?
5. **Xəta yolları:** `fetch`-i əvəz edib 401/500/502 məcbur et.
6. **Davamlılıq:** yeniləmədən sonra qalırmı?
7. **Mobil:** 375px — üfüqi sürüşmə yox, toxunma hədəfi ≥44px.
8. **Dil:** AZ ⇄ EN ⇄ RU.
9. **Yoxlama:** `npm test` (frontend + backend), `npm run build`.
10. **Commit + push**, sonra **canlı saytdan marker yoxla**.
11. Plan faylını yenilə; bu fayla yeni dərs əlavə et.

---

## 13. Əhatədən kənar (istifadəçinin qərarı)

Toxunma: parametrli SQL, RBAC-ın özü, CSRF/CORS/CSP, rate limiting.
Bir sessiyada **bir bölmə** — tam bitirilib sonra növbətiyə keçilir.
Dizaynı öz təşəbbüsünlə yenidən qurma.
