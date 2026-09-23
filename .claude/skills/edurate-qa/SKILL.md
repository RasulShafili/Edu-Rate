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

**Daha aldadıcı forması (Suallar):** `AnimatePresence` çıxan elementi son
render-in **donmuş surəti** ilə saxlayır. Rolu dəyişəndən sonra (moderator →
tələbə) tələbənin ekranında moderatorun silmə düyməsi göründü — "icazə səhvi"
kimi görünürdü. Əslində bağlanmış panelin donmuş surəti idi: `opacity: 0`,
DOM-da hələ də var. Tab öndə olanda belə kadr işləməyə bilər.

Eyni səbəbdən səhifə "Yüklənir…" vəziyyətində ilişmiş, şəbəkə jurnalında
sorğu isə **heç görünməmiş** kimi idi.

```js
// kadrları məcbur et, sonra yenidən ölç
await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
```

Ekran görüntüsü də kadr işlədir — ondan sonra vəziyyət düzəlirsə, artefaktdır.
Hər rol yoxlamasında `opacity` və elementin sayını da oxu, yalnız mətni yox.

**`visibilityState === "visible"` kadr işləyir demək deyil (Mentorlar).**
`document.hidden` `false`, `visibilityState` "visible" idi, amma kadr sayı
**0/saniyə** idi — panel görünən sayılır, ekrana çəkilmir. Yeganə etibarlı ölçü:

```js
let n = 0, stop = false;
const tick = () => { n++; if (!stop) requestAnimationFrame(tick); };
requestAnimationFrame(tick);
await new Promise(r => setTimeout(r, 1000)); stop = true;   // n === 0 -> kadr yoxdur
```

**Skriptdə `requestAnimationFrame`-i gözləmə** — kadr yoxdursa promise heç
bitmir və alət 45 saniyədən sonra vaxt aşımı verir. Yalnız `setTimeout`.

**Donmuş surətdəki düymə də işləyir, amma ekran yenilənmir.** Bağlanmış kartın
donmuş çıxış surətində "Müraciəti geri çək"-ə kliklədim: sorğu getdi (204),
kart isə hələ "gözlənilir" yazırdı — "geri çəkmə işləmir" kimi göründü. Kartı
yenidən açanda real vəziyyət düzgün idi. Klikdən əvvəl hədəf elementin
**açıq** kartda olduğunu yoxla (`is-expanded`, `opacity`).

**`AnimatePresence mode="wait"` — növbəti vəziyyət heç gəlmir (Dəstək).**
Bu rejimdə yeni blok köhnənin çıxış animasiyası bitənə qədər qoşulmur. Kadr
yoxdursa forma göndərilir (sorğu 201), amma uğur paneli DOM-da **yoxdur** —
"göndərmə işləmir" kimi görünür. Oxumazdan əvvəl ekran görüntüsü ilə kadr işlət.

### 2.4 Mobil emulyasiyada ekran görüntüsü kəsilir

375px emulyasiyasında görüntü sağdan kəsilmiş göründü (kartın kənarı
ekrandan çıxmış kimi). Ölçülər bunu təkzib etdi: `scrollWidth == clientWidth`,
sağ kənarı `innerWidth`-i keçən element yoxdur. Görüntü panelə sığdırılarkən
kəsilir. **Üfüqi sürüşmə iddiası yalnız rəqəmlə:**

```js
[...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1)
```

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

**Elementin `opacity`-sini də hesaba qat.** `kuds.css` bəzi mətnlərə
`opacity: .78` verir; rəng özü keçir, görünən mətn isə keçmir (FAQ cavabı
3.04:1 idi). Ön planın alfasını `alpha × opacity` kimi götür.

**Bütün bölməni bir dəfəyə süz**, tək-tək element seçmə — gözlə tapılmayan
mətnlər belə çıxır:

```js
for (const el of root.querySelectorAll('*')) {
  const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  if (!own || el.tagName === 'OPTION') continue;
  const fs = parseFloat(getComputedStyle(el).fontSize), cr = ratio(el);
  if (fs < 11 || cr < 4.5) console.log(el, fs, cr);
}
```

Bu saytda **8–10px** mətn də köhnə temanın qalığıdır (Mentorlar, Dəstək).
Hər vəziyyəti ayrıca süz: forma, uğur ekranı, xəta, açıq kart.

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

**Rol matrisini BFF üzərindən qurma.** BFF-in öz limit sayğacı (IP üzrə) rədd
edilmiş (403) cəhdləri də sayır: mentorluq üçün gündə 5 — dörd rol yoxlaması
və bir tələbə müraciəti limiti bitirdi, altıncı sorğu 429 aldı. Matrisi
birbaşa backend-ə (`:3001`) qur; BFF-dən yalnız bir-iki zəncir sübutu üçün
istifadə et. Sayğac `next dev` yenidən başlayanda sıfırlanır. (Rate limiting-ə
toxunma — §13.)

**Backend limiti uğursuz sorğuları da sayır.** Dəstəkdə limit 30 dəqiqədə 4
müraciətdir; iki müraciət və iki validasiya yoxlaması (422) onu bitirdi.
Sorğu büdcəsini əvvəlcədən say. Bitmiş limit faydalıdır: real 429 yolunu
interfeysdən sına, sonra QA serverini yenidən başladıb (yaddaş limiti sıfırlanır)
uğur yolunu sına.

**Saxta sessiya + real BFF = vaxtı bitmiş sessiya.** İnterfeys istifadəçini
daxil olmuş sayır, BFF-ə isə kuki getmir. `optionalAuthenticate` işlədən
endpoint-lər bunu anonim sorğu kimi qəbul edir — real həyatdakı vaxtı bitmiş
tokenin eynisi. Dəstəkdə bu yolla tapıldı: müraciət səssizcə anonim yaranır,
interfeys isə "tarixçədə izlə" deyirdi.

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

### Marker özü düzgün seçilməlidir

Bir dəfə `/community` səhifəsində `peer-card-topline` sinfini marker seçdim və
**ilk cəhddə "deploy oldu"** nəticəsi aldım. Yanlış idi: o sinif yalnız daxil
olmuş istifadəçiyə render olunur, anonim sorğuda heç vaxt görünmür — yəni
marker həm köhnə, həm yeni kodda "tapılmadı" verirdi.

**Qayda:** marker **hər iki halı ayırd etməlidir**. Etibarlı üsul: köhnə koda
xas mətnin **getdiyini** və yeni koda xas açarın **gəldiyini** eyni anda yoxla:

```bash
JS=$(curl -s "$URL/<yol>" | grep -oE '/_next/static/[a-z/]*chunks/[^"\\ ]*\.js' | sort -u)
echo "fayl sayi: $(echo "$JS" | wc -w)"   # 0 -> naxis sehvdir, netice hec ne subut etmir
for f in $JS; do B=$(curl -s "$URL$f")
  echo "$B" | grep -q '<KOHNE METN>' && OLD=$((OLD+1))
  echo "$B" | grep -q '<YENI ACAR>'  && NEW=$((NEW+1)); done
# gozlenilen: OLD=0, NEW>0
```

Anonim `curl` istifadəçiyə bağlı interfeysi görmür — markeri ya ictimai
hissədən, ya da JS/CSS paketindən seç.

**Next 16.3.6-dan bəri aktiv yolu dəyişib:** `/_next/static/immutable/chunks/`.
Köhnə `'/_next/static/chunks/'` naxışı canlı HTML-də **heç bir fayl** tapmır və
marker 0/0 verir — "köhnə mətn getdi" kimi oxunur (Ölü admin kodu sessiyasında
baza ölçüsündə tutuldu). Ona görə yuxarıdakı naxış `[a-z/]*chunks` işlədir və
fayl sayını çap edir.

**Yalnız silmə olan dəyişiklikdə "yeni açar" yoxdur.** Onda ikinci tərəf
**nəzarət sinfidir**: eyni CSS/JS faylında qalan canlı bir sinif (məsələn
`admin-table-action`). Keçid şərti: `OLD=0` **və** `CTRL>0` **və** fayl sayı > 0.
Push-dan **əvvəl** canlıda baza ölç (`OLD>0, CTRL>0`), lokal build-də isə
gözlənilən son halı (`OLD=0, CTRL>0`) — hər iki tərəf ölçülmüş olsun.

### Asılılıq yeniləməsinin markeri: `window.next.version`
Next 16.2.12 → 16.3.6 yeniləməsində chunk-larda `"16.3.6"` sətrini curl ilə
axtardım: 20 cəhd boyunca köhnə=0, yeni=0 — 10 dəqiqə boşa getdi. Versiya
`window.next={version:"16.3.6"}` şəklində HTML-in skript siyahısında olmayan
chunk-dadır. Etibarlı yol: brauzerdə canlı səhifəni aç, `window.next?.version`
oxu. **Hər markeri əvvəlcə lokal production build-də (`.next/static/chunks`)
və HTML-in həqiqətən yüklədiyi faylda sına**, sonra canlıda gözlə.

**Admin 2-ci hissədə eyni tələ bir daha:** tərcümə açarı markerini düzgün
yoxladım (lokal build 1, production 0), sonra isə gözləmək üçün **başqa**,
yoxlanmamış marker qoydum — `/events` HTML-inin chunk siyahısının heşi. 13 dəqiqə
"dəyişmədi" dedi, halbuki deploy çoxdan olmuşdu: dəyişən kod (lüğət, CSS) HTML-in
sadaladığı chunk-larda deyil, dinamik yüklənir. Brauzerdə yüklənmiş resursları
(`performance.getEntriesByType('resource')`) yoxlayanda açar 0→1 idi.
**Qayda:** gözləmə döngüsü də markerdir — onu da əvvəlcə yoxla, ya da birbaşa
təsdiqlənmiş markeri döngüdə işlət.

### Backend dəyişikliyi yalnız girişlə görünürsə
Render-in pulsuz planı boş qalanda yatır; soyuq başlanğıc da `/api/health`
`uptime`-ını sıfırlayır. Ona görə kiçik `uptime` **deploy sübutu deyil**.
Repo özəldir, GitHub API deploy statusunu vermir. Bu halda iddia etmə:
"frontend təsdiqləndi, backend kənardan təsdiqlənə bilmədi" de.
`/api/openapi.json` production-da yalnız əsas admin üçündür (401) — marker olmur.

**Miqrasiya varsa, `/api/health` ən yaxşı backend markeridir.** O,
`migrationVersion` (tətbiq olunmuş) və `latestMigrationVersion` qaytarır. Yeni
miqrasiya ilə 24 → 25 keçidi iki şeyi birdən sübut edir: yeni kod deploy olunub
**və** miqrasiya SQL-i production Postgres-də xətasız icra olunub (xəta olsa
server ümumiyyətlə başlamazdı). Lokalda Postgres olmadığı üçün SQL-i başqa
yolla sınamaq mümkün deyil — bu, yeganə real yoxlamadır.
Production-da yazma sorğusu ilə marker yoxlamaq olmaz (real bazaya test
məlumatı düşür). Mümkün olanda
dəyişikliyə **anonim görünən** kiçik bir yan təsir planla (məsələn yeni
marşrutun 404→401 fərqi, Suallar sessiyasında olduğu kimi).

---

## 9. Lokal məlumat ≠ canlı məlumat

Seed elanlarının müddəti bitmişdi, ona görə lövhə boş görünürdü. Səhv sanmadan
əvvəl production-u yoxladım: orada 3 aktiv elan var idi.

**Qayda:** "boş / yoxdur" tipli tapıntıda canlı API-ni yoxla:
`curl -s https://edurate-api.onrender.com/api/<yol>`.

### Yaddaş rejimi baza səhvlərini gizlədir

`db/*.ts` funksiyalarının hər birinin iki qolu var: `if (!databasePool)`
(yaddaş) və SQL. Semantika fərqlənə bilər. Suallarda yaddaş qolu sualı
**silirdi**, SQL qolu isə `status='hidden'` qoyurdu. Nəticədə gizlədilmiş suala
səs vermək lokalda 404 verirdi (düzgün görünürdü), production-da isə 200 —
çünki SQL sorğusu `status`-u yoxlamırdı. Lokal testlər (yaddaş rejimi) bunu
**heç vaxt** tuta bilməz.

**Qayda:** silmə/gizlətmə olan hər funksiyada iki qolu yan-yana oxu və soruş:
"gizlədilmiş sətir digər sorğularda (siyahı, say, səs, cavab) süzülürmü?"
SQL dəyişikliyini lokalda sınaya bilmirsənsə, bunu açıq de və deploydan sonra
production-da **yalnız oxuyan** sorğu ilə yoxla.

### İki API siyahısını birləşdirən açarı real məlumatla yoxla
"Yaradılıb, amma yenilənəndən sonra görünmür" nümunəsinin tipik səbəbi.
Mentorlarda kataloq kartın id-sini **slug**, müraciət isə mentoru **uuid**
(`mentorProfileId`) ilə saxlayırdı; interfeys birini o birində axtarırdı və
heç vaxt tapmırdı. Kodu oxuyanda hər ikisi "mentorId" kimi görünür.
**Qayda:** iki endpoint-in cavabını yan-yana çap et və birləşdirmə açarının
hər iki tərəfdə eyni dəyər olduğunu gözlə gör:

```js
const hit = catalog.find((m) => m.id === (req.mentorProfileId ?? req.mentorId));  // false -> səhv
```

### Statik mətn də iddiadır
Dəstəyin FAQ-ı "hər mentorluq müraciətini icma nümayəndəsi nəzərdən keçirir"
və "tədbir yerini başqasına keçiririk" deyirdi. Əvvəlki bölmələrdə yoxlanmış
davranışla müqayisə edəndə ikisi də yalan çıxdı. FAQ, uğur mesajı, boş vəziyyət
mətnini **kodla yoxlanmış davranışla** tutuşdur — xüsusən "biz ... edirik" tipli
cümlələri.

### Qəbul edən paneli də yoxla
Bir şey yaradılıb API-də varsa, iş bitmir: onu **emal edəcək** tərəf lazımi
sahəni görürmü? Dəstəkdə admin API ad və e-poçtu qaytarırdı, admin paneli isə
göstərmirdi — anonim müraciətə cavab vermək mümkün deyildi. Mentorlarda da
mentor paneli tələbənin qeydini göstərmirdi. Hər axın üçün: yaradan nə görür,
**emal edən** nə görür, və bu, əməli yerinə yetirməyə kifayətdirmi?

### Yer tutucu mətn real məlumat kimi saxlanıla bilər
Backend yeni hesabı `year = "Kurs məlumatı əlavə edilməyib"` və hazır "haqqında"
cümləsi ilə yaradır — bunlar bazada **dəyər** kimi durur. Nəticələr: profil
tamamlanması hamı üçün 100% idi; redaktə forması yer tutucunu sahənin dəyəri
kimi göstərirdi və "Yadda saxla" onu istifadəçinin real kursu kimi yazırdı.
**Qayda:** `createUser` və sütun `DEFAULT`-larına bax; "məlumat əlavə edilməyib"
tipli mətn görsən, ondan hesablanan hər şeyi (faiz, forma, "boş" vəziyyəti)
yoxla. Törəmə göstəricini xam dəyərdən hesabla, göstəriş mətnindən yox.

### Redaktə endpoint-i əlavə etməzdən əvvəl sinxronizasiyanı oxu
İş panelində mentor profilini redaktə etmək üçün endpoint yazanda məlum oldu ki,
`synchronizeProfessionalProfilesForUser` hər panel açılışında (bazada) profilin
ixtisas, bio, şəhər sahələrini istifadəçi profilindən **yenidən yazır**. Həmin
sahələri redaktə etmək mənasız olardı — növbəti açılışda geri qayıdırdı. Yalnız
sinxronizasiyanın toxunmadığı sütunları (əlçatanlıq, format, dillər, təcrübə)
redaktəyə açdım.

**Tələ:** "dəyişiklik panel yenidən açılanda qalır" yoxlamasını yaddaş
rejimində apardım — orada sinxronizasiya mövcud profilə ümumiyyətlə toxunmur,
ona görə nəticə heç nəyi sübut etmirdi. Təminat SQL-in (`UPDATE` və
`INSERT … ON CONFLICT DO UPDATE SET …` siyahısının) oxunmasından gəldi.
**Qayda:** yaddaş və baza qolları fərqli işləyirsə, lokal "keçdi" nəticəsini
baza üçün sübut sayma; SQL-i oxu və bunu açıq de.

### Siyahı kəsilməsi göstəricini yalana çevirir
Mentor növbəsi `slice(0, 12)` ilə kəsilirdi, göstərici isə hamısını sayırdı:
köhnə gözləyən müraciət təzə qərarların arxasında qalırdı — "Yeni müraciət: 1",
siyahıda isə yox. Hər `slice`/`LIMIT` gördükdə soruş: kəsilən hissədə
**əməl tələb edən** element qala bilərmi? Belədirsə, onları önə çək.

### Göstəricinin hesablanmasını etiketi ilə tutuşdur
Admin icmalında dörd ayrı "yalan" var idi və heç biri ekranda səhv görünmürdü:
- **"Açıq tədbir"** bitməmiş HƏR tədbiri sayırdı — müəllimin yoxlanış gözləyən
  qaralamaları da; **"Tələbə klubu"** gözləyən və məhdudlaşdırılmış klubları.
- Hər kartda yaşıl **artım oxu** və "əvvəlki dövrlə müqayisə" — backend
  `trend: "up"`-ı sabit yazırdı, heç bir müqayisə yox idi.
- **"Platforma aktivliyi"** qrafiki `createdAt < ay sonu` sayırdı — yəni yığılmış
  cəm; xətt heç vaxt enə bilməz, aktivliyi yox, böyüməni göstərir.
- Axtarış placeholder-i **"ad və ya məlumata görə"** deyirdi, `filterRows` yalnız
  adı yoxlayırdı.
**Qayda:** hər rəqəm/qrafik/axtarış üçün backend-də onu quran sətri tap və
filtr şərtini etiketin dediyi ilə söz-söz tutuşdur. Ox, faiz, "müqayisə" kimi
törəmə göstəricidə hesablamanın **mövcud olduğunu** yoxla — sabit dəyər ola bilər.
Düzəliş testi: qaralama yarat → "açıq" sayı dəyişməməli, "qaralama" +1 olmalıdır.

### Sərbəst mətn + backend normallaşdırması = səssiz dəyişiklik
Admin tədbir formasında kateqoriya sərbəst mətn idi, backend isə `normalizeCategory`
ilə onu dörd dəyərə salırdı: tanınmayan hər söz ("İdman") səssizcə "Design"
olurdu; redaktədə sahə ingiliscə "Technology" ilə açılırdı. Backend dəyəri
çevirirsə, forma **seçim** olmalıdır — dəyər bazadakı kod, görünən ad lüğətdən.

### Silmə yollarını müqayisə et
Admin istifadəçini silərkən peşəkar profilini gizlədirdi, istifadəçi özü
silərkən yox — hesabını silən mentor kataloqda real adı ilə qalırdı. Eyni
nəticəyə aparan iki yol varsa (admin silir / özü silir, admin yaradır / özü
yaradır), yan təsirlərini yan-yana müqayisə et.

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

### Hər yamaq skriptinə yeni ad ver
Admin 2-ci hissədə `Write` `patch_admin_backend.py`-ni yazmaqdan imtina etdi
(1-ci hissədən qalmış, bu sessiyada oxunmamış fayl), eyni mesajdakı `Bash` isə
**köhnə** skripti işə saldı. Yalnız köhnə skriptin nisbi yolları tapılmadığı
üçün heç nə yazılmadı — başqa kataloqda olsaydı, köhnə yamaq ikinci dəfə
tətbiq olunardı. **Qayda:** skript adına hissə/tarix qoy (`p2_backend.py`) və
`Write` ilə `Bash`-i eyni mesajda birləşdirəndə `Write`-ın uğurunu yoxlamadan
nəticəyə inanma.

### Paralel sessiya eyni işçi qovluqda
Ölü kod tapşırığı ayrı sessiyada, amma **eyni** qovluqda işlədi: `git status`-da
onun stage-ə aldığı silinmələr və CSS dəyişikliyi görünürdü. Adi `git commit`
onları mənim commit-imə qatardı. **Qayda:** belə halda yalnız öz fayllarını
`git commit -- <yollar>` ilə commit et, onun toxunduğu fayllara (burada CSS,
skill faylı) o bitənə qədər toxunma, və o dəyişən faylı redaktədən əvvəl yenidən oxu.

### Skript faylı yaz, heredoc yox
Uzun Python `<<'PY'` heredoc-ları apostrof və dırnaq üzündən **iki dəfə** bash
parse xətası verdi. Uzun skripti `Write` ilə fayla yaz, sonra işə sal.

### Dəqiq lövbər seç
- `"useT" not in s` yoxlaması **`useTransform`-a görə** yanlış işlədi və import
  əlavə olunmadı. Alt-sətir yox, **import yolunu** yoxla: `"i18n/LanguageProvider" not in s`.
- Ümumi regex hook-u **yanlış funksiyaya** saldı və generik tipi parçaladı.
  Lövbər hədəf komponentin daxilində **unikal** olmalıdır (məsələn
  `}: AdminRecordFormSheetProps) {`), ümumi nümunə yox.

### Sətir sayı ≠ təkrar sayı
`grep -c` **sətri** sayır, təkrarı yox. `community-card` üçün `grep -c` 50
verdi, `grep -o ... | wc -l` isə 55 — çünki bir neçə sətirdə sinif iki dəfə
keçirdi (`.x-shell.is-active .x-button`). Yamağın gözlənilən sayını `grep -c`
üzrə qursan, skript düzgün işlədiyi halda "uyğunsuzluq" deyib dayanacaq.
Təkrar sayı lazımdırsa: `grep -o 'naxış' fayl | wc -l`.

### Sətir sonu fayldan-fayla dəyişir — həmişə aşkarla
Əvvəl "CSS faylları CRLF-dir" yazmışdım. **Yanlış ümumiləşdirmə idi:** Suallar
sessiyasında `creative.css` artıq LF idi, `backend/src/db/questions.ts`,
`routes/questions.ts`, `QuestionsExperience.tsx` isə CRLF — və yamaq ilk
cəhddə "0 dəfə" deyib dayandı. Fayl tipinə görə təxmin etmə; **hər faylda**
aşkarla (`file <yol>` və ya aşağıdakı kod). Git `autocrlf` işlədir, ona görə
repoda LF, işçi nüsxədə qarışıqdır.

**Git Bash-da `grep $'\r'` ilə yoxlama yalandır.** Windows üçün GNU grep
faylı oxuyarkən CR-ı atır, ona görə CRLF faylı "LF" kimi göstərir. Ölü admin
kodu sessiyasında `kuds.css`-i belə "LF" saydım; baytlarla oxuyan skript
düzgün olaraq CRLF tapdı. Yalnız bayt səviyyəsində yoxla:
`python -c "import sys;print(b'\r\n' in open(sys.argv[1],'rb').read())" <fayl>`
və ya `file <fayl>`.

Köhnə qeyd (artıq etibarsız — hər dəfə ölç): `app/globals.css`, `app/kuds.css` **CRLF** sətir sonu
işlədir (sentyabr 2026-da `globals.css` işçi nüsxədə LF, `kuds.css` CRLF idi). `newline=""` ilə oxuyanda çoxsətirli lövbərdəki `\n` **heç vaxt uyğun
gəlmir** — lövbər tapılmır, skript isə düzgün işləyir. Faylın öz sonluğunu
aşkarla (`eol = "\r\n" if "\r\n" in text else "\n"`) və lövbəri onunla qur;
yazarkən də `newline=""` saxla, yoxsa bütün fayl bir commit-də dəyişmiş görünür.

### Dev server köhnə CSS verə bilər
Mentorlarda `globals.css`-i dəyişdim, brauzer isə köhnə qaydanı (10px) ölçdü.
`creative.css`-in yeni qaydaları gəlirdi, `globals.css`-inkilər yox — hətta
`touch` və dev serveri **yenidən başlatdıqdan sonra da**. Turbopack-ın `.next/dev`
keşi faylı başlanğıc versiyasında saxlayırdı. Üslub ölçməzdən əvvəl verilən
CSS-i yoxla, fərqlidirsə dev serveri dayandır, **`.next/dev`-i sil**, yenidən başlat:

```bash
CSS=$(curl -s localhost:3000/<yol> | grep -oE '/_next/static/[a-z/]*chunks/[^"\\ ]*\.css' | sort -u)
for f in $CSS; do curl -s "localhost:3000$f" | grep -c '<yeni-qayda>'; done
```

Production build (`npm run build`) bu keşdən təsirlənmir — onun CSS-ini
`.next/static/chunks/*.css`-də ayrıca yoxla.

### Qoruyucu say səhv də ola bilər
Ölü CSS silərkən 11 sətir gözlədim, skript 12 tapıb dayandı — media
blokundakı ikinci `.mentor-avatar > i` sətrini unutmuşdum. Qoruyucu düzgün
işlədi. Gözlənilən sayı təxmin etmə, əvvəlcə `grep -n` ilə say.

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
- **Xətanı mətn kimi yox, açar kimi saxla.** `setError(t("..."))` dil
  dəyişəndə köhnə dildə qalır (Suallarda EN səhifədə azərbaycanca "Sessiyan
  bitib" göründü). `setError("questions.voteFailed")` + render-də `t(error)`.
- **`formatDateTimeWithMonths` UTC saatını göstərir.** `getStableDateParts`
  ISO sətrini olduğu kimi oxuyur (server/brauzer eyni olsun deyə) — `…T18:48Z`
  Bakıda 22:48-dir, sayt isə 18:48 yazır. Yalnız brauzerdə render olunan yerdə
  `new Date()` + lüğət ay adları işlət; SSR olunan yerdə saat qurşağını açıq ver.
- **`t()` cəm formasını bilmir.** `"{count} answers"` 1 üçün "1 answers" verir.
  EN/RU üçün saydan asılı olmayan forma yaz: `"Answers: {count}"`,
  `"Ответов: {count}"`. (Azərbaycan dilində problem yoxdur — say ilə isim tək qalır.)
- **`t()` tapılmayan açarda açarın özünü qaytarır.** Bazadan gələn dəyəri
  (`clubCategory.${x}`) açara çevirəndə naməlum dəyər ekranda
  "clubCategory.Robotexnika" kimi görünər. Açar = nəticə olarsa xam dəyərə qayıt
  (`labelOr(t, key, raw)`).
- **Backend-in hazır mətnini göstərmə, xam sahədən qur.** Admin cədvəli
  `detail`/`metric`-i backend-dən azərbaycanca alırdı (istifadəçi sətrində hətta
  xam `student` rolu). Backend rəqəm/kod göndərsin (`counts`, `month`,
  `emailVerified`), mətni interfeys qursun; köhnə backend üçün ehtiyat saxla.
- **Ortaq komponentləri unutma.** Admin forması tərcümə olunsa da içindəki
  `SecureImagePicker`/`ImageDraftPicker` azərbaycanca qalırdı — çıxarıcını
  görünüşün **import etdiyi** komponentlərə də işlət.
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
9. **Yoxlama:** `.github/workflows/ci.yml`-in addımlarını **eyni ardıcıllıqla,
   `TZ=UTC` ilə** işlət (§16) — təkcə `npm test` + `npm run build` kifayət deyil.
10. **Commit + push**, sonra **canlı saytdan marker yoxla**.
11. Plan faylını yenilə; bu fayla yeni dərs əlavə et.

**Eyni işçi qovluqda başqa sessiya ola bilər.** Ölü admin kodu sessiyasında
iş gedərkən başqa sessiya eyni repoda iki commit etdi (`tests/date.test.mjs`,
bu fayl) — başlanğıcdakı "dəyişdirilmiş" fayl birdən təmiz göründü. Qaydalar:
- Başlanğıcda gördüyün yad dəyişikliyi (izlənməyən `AGENTS.md`/`CLAUDE.md`,
  başqasının fayl dəyişikliyi) **öz commit-inə qatma**.
- Commit-i **yol siyahısı ilə** et: `git commit -F msg -- <yol1> <yol2>` —
  `-a` və `git add -A` yox. Sonra `git show --stat HEAD` ilə yalnız öz
  fayllarını gör.
- Commit və push-dan əvvəl `git fetch` + `git log`: HEAD dəyişibmi?
- Bu faylı redaktə etməzdən əvvəl onu **yenidən oxu** — o biri sessiya da
  buraya yazır.
- `npm ci` `node_modules`-i silir və o biri sessiyanın dev serverini yıxa
  bilər; `package.json`/lock dəyişməyibsə onu atla və bunu açıq de.

---

## 13. Əhatədən kənar (istifadəçinin qərarı)

Toxunma: parametrli SQL, RBAC-ın özü, CSRF/CORS/CSP, rate limiting.
Bir sessiyada **bir bölmə** — tam bitirilib sonra növbətiyə keçilir.
Dizaynı öz təşəbbüsünlə yenidən qurma.

---

## 14. Ölü kod: silmədən əvvəl təsdiqlə

Komponentin adını grep etmək **kifayət deyil**. Üç yeri ayrıca yoxla:

1. **Adın özü** — bütün repoda (`--exclude-dir=node_modules --exclude-dir=.next`),
   əlavə olaraq `tsconfig.tsbuildinfo`-nu da kənara qoy: o, köhnə build qeydi
   olduğu üçün silinmiş ada da uyğun gəlir və yalançı istifadə göstərir.
2. **Dinamik idxal və barrel** — `dynamic(() => import(...))`, `React.lazy`,
   `app/**/index.ts`. EduRate-də barrel fayl yoxdur, dinamik idxal isə var
   (`PlatformProvider` → `ChatDock`), ona görə bu yoxlama realdır.
3. **Komponentin render etdiyi CSS sinifləri** — başqa komponent eyni sinfi
   işlədə bilər; o halda komponent ölüdür, sinif isə yox.

**Nəyin əvəz etdiyini tap.** `CommunityCard` öz-özünə ölməmişdi:
`/community` → `ConnectionsExperience` → `PeerDirectory` keçidi onu arxada
qoymuşdu. Marşrutu sonuna qədər izlə — əvəzedicini görmədən silmə.

**Paylaşılan selektor siyahısından yalnız ölü üzvü çıxar.** Ölü sinif çox vaxt
canlı siniflərlə eyni qaydanın içində olur
(`:is(.event-card, .peer-card, .community-card-shell)`). Bütün qaydanı silmək
canlı kartların üslubunu aparır. Skriptə qoru qoy: bir sətri **yalnız** onun
bütün selektorları ölü sinfə aid olduqda sil, əks halda `SystemExit` at.

**Qalan tərəfdaşın canlılığını da yoxla — amma onu öz başına silmə.**
`.admin-sidebar, .admin-skeleton__sidebar { … }` siyahısında
`.admin-skeleton__sidebar` saxlanmalı idi, çünki ölü komponent onu render
etmirdi. Yoxlayanda məlum oldu ki, onu **heç bir** TSX render etmir — o da
əvvəldən ölü idi. Belə tapıntını istifadəçiyə ayrıca bildir; əhatəni səssizcə
genişləndirmə.

**Kaskad: silinən faylın idxallarını tərsinə yoxla.** Komponent silinəndə
yalnız onun işlətdiyi köməkçilər də ölür. `AdminClientAccessGate` silinəndə
`app/lib/auth/admin-session.ts` (`parseAdminSessionPayload`) və
`AdminSkeleton`-ın `scope="gate"` qolu (`.admin-access-skeleton*` CSS ilə)
istifadəçisiz qaldı. Silinən faylın **hər idxalı** üçün
`grep -rn '<ixrac adi>'` işlət; tək istifadəçi silinən fayldırsa, bunu
hesabatda göstər.

**Sinfin adını daşıyan xüsusi xassə də ölü ola bilər.** `--admin-sidebar-width`
canlı `.admin-dashboard` qaydasında elan olunurdu, onu isə yalnız ölü
`.admin-sidebar` oxuyurdu. Prefiks grep-i bunu tutur; yalnız elan sətrini sil
(bütün gövdəsi bu xassə olan qaydanı isə tam), qalan qaydaya toxunma. Əvvəlcə
`grep -rn 'var(--<ad>'` ilə başqa oxuyan olmadığını təsdiqlə.

**Sonda sıfırı təsdiqlə:** `grep -rn '<sinif-prefiksi>'` boş qaytarmalıdır,
sonra `npx tsc --noEmit` + `npm test` + `npm run build`. Build vacibdir — CSS-i
PostCSS keçirir, ona görə səhv silmədən yaranan sintaksis pozuntusunu yalnız o
tutur.

---

## 15. Brauzerdə parol yazmadan rol görünüşünü yoxla

Brauzerdə giriş formasına parol yazmıram — öz yaratdığım fixture hesabı olsa
belə, bu, təhlükəsizlik qaydasıdır və istifadəçi icazə versə də dəyişmir.
Rol görünüşü üçün iş görən üsul (Suallar sessiyasında sınandı):

1. **Sessiyanı brauzerdə saxtalaşdır.** `AuthProvider` sessiyanı `online`
   hadisəsində yenidən oxuyur. `/api/auth/session`-ı əvəz et və hadisəni at:

   ```js
   window.__realFetch = window.__realFetch || window.fetch;
   const user = { id: "fake", name: "QA", email: "x@example.az", accessRole: "owner_admin",
                  university: "Qarabağ Universiteti", faculty: "", program: "", city: "Bakı" };
   window.fetch = function (i, init) {
     const u = typeof i === "string" ? i : i?.url ?? "";
     if (u.startsWith("/api/auth/session"))
       return Promise.resolve(new Response(JSON.stringify({ data: { user } }), { status: 200 }));
     return window.__realFetch.apply(this, arguments);
   };
   window.dispatchEvent(new Event("online"));
   ```

   Bu, **yalnız interfeysi** dəyişir; serverdə kuki yoxdur.
2. **Bunun faydalı yan təsiri:** yazma sorğuları real BFF-ə gedir və 401
   qaytarır — yəni vaxtı bitmiş sessiya (D12) yolu avtomatik sınanır.
3. **Uğur halı** üçün həmin sorğunu əvəz et (`204`/`201`) və interfeysin
   reaksiyasını yoxla; eyni zamanda sorğunun **URL və metodunu** qeyd et.
4. **BFF → backend** zəncirini ayrıca, brauzerdən kənarda sübut et: node/curl
   ilə backend-dən token al və BFF-ə `Cookie: edurate_api_token=<token>`
   başlığı ilə müraciət et (kukisiz də — 401 gözlənilir).

Üç sübut birlikdə tam zənciri örtür: interfeys düzgün sorğunu göndərir (3),
BFF onu backend-ə ötürür (4), backend rol qaydasını tətbiq edir (§7).

**Qeyd:** saxta sessiya ilə açılan digər komponentlər (söhbət paneli, avatar)
də 401 alır — konsoldakı bu xətalar test artefaktıdır, bölmənin səhvi deyil.
Hansı sorğuların sənə aid olduğunu `read_network_requests` ilə ayır.

**Git Bash-dan göndərilən Azərbaycan mətni** backend-ə `?` kimi çatır
(kodlaşdırma). Test məlumatını `.mjs` skripti ilə yarat — `fetch` UTF-8 göndərir.

### Serverdə qorunan səhifələr (`/profile`, `/settings`)
Bu səhifələr kuki yoxdursa serverdə `/auth`-a yönləndirir — brauzerdəki saxta
sessiya işləmir. İşləyən yol: **server HTML-ini kuki başlığı ilə al** (node
`fetch`, `Cookie: edurate_api_token=…; edurate_lang=en`) və mətni yoxla. Bu,
həm də SSR ilə brauzer arasındakı fərqi üzə çıxarır: Profildə server HTML-i
"Çatışmayan: İxtisas" və `aria-valuenow=0` göstərirdi, API isə 67% deyirdi —
layout ilk render üçün tam profil əvəzinə yer tutuculu obyekt qururdu.

Kontrast, mobil və interaktiv hallar üçün isə real sessiya lazımdır — onu
yalnız istifadəçi aça bilər. Ondan xahiş etməzdən əvvəl `tabs_context` ilə
brauzer panelinin **görünüb-görünmədiyini** yoxla və gizlidirsə bunu de: bir
dəfə panel gizli idi, istifadəçi daxil olmadı, vizual yoxlama açıq qaldı.

Diqqət: məlumatı brauzerdə SWR ilə yükləyən səhifədə (İş paneli) server
HTML-i yalnız skelet göstərir — kuki ilə HTML yoxlaması məzmunu örtmür. Orada
məzmunu BFF cavabları ilə (kuki başlığı ilə) yoxla, HTML-dən isə yalnız server
tərəfdə render olunan hissələri (naviqasiya, başlıqlar) götür.

### Giriş limiti də dolur
Backend girişi 15 dəqiqədə 10 dəfə ilə məhdudlaşdırır. Hər yoxlama skriptində
yenidən daxil olmaq bu limiti bir sessiyada bitirdi (`RATE_LIMITED`). Hər
hesaba skriptdə **bir dəfə** daxil ol və tokeni təkrar işlət; limit bitərsə
QA serverini yenidən başlat.

---

## 16. CI: nəticəsini görmürəm, ona görə push-dan əvvəl təkrarla

**Baş verdi:** GitHub Actions-in frontend işi ~10 push ardıcıl yıxıldı və mən
heç birini görmədim — istifadəçi e-poçtlardan tapdı. `gh` quraşdırılmayıb, repo
özəldir, Actions API giriş istəyir: **CI nəticəsi mənə görünmür.** Vercel CI-dən
asılı deyil, ona görə deploy markeri "hər şey qaydasındadır" deyirdi.

Üç ayrı səbəb bir-birini gizlədirdi:
1. **`npm audit`** — kodu heç kim dəyişmədən yıxıldı: 8 sentyabrda `next`
   (iki kritik RCE), `sharp`, `js-yaml` üçün xəbərdarlıq dərc olundu. Build də,
   test də audit etmir.
2. **Lint xətaları** — öz düzəlişlərim gətirmişdi (build lint etmir).
3. **`tests/date.test.mjs`** — lokalda keçir, CI-də yıxılır: CI **UTC**-dədir,
   maşın **Bakı (UTC+4)**. Test girişləri `+04:00` ilə yazılmışdı, funksiya isə
   lokal həftə hesablayır. 24 avqustdan bəri belə idi; audit bir addım əvvəl
   dayandırdığı üçün görünmürdü.

**Qayda — hər push-dan əvvəl `ci.yml`-in addımları, eyni sıra ilə:**

```bash
export TZ=UTC
npm ci && npm audit --audit-level=high && npm run lint && npm test && \
  EDURATE_API_BASE_URL=https://edurate-api.onrender.com \
  NEXT_PUBLIC_SITE_URL=https://edu-rate-nu.vercel.app \
  EDURATE_APP_ORIGIN=https://edu-rate-nu.vercel.app npm run build
cd backend && npm ci && npm audit --audit-level=high && npm run typecheck && npm test && npm run build
```

- `TZ=UTC` vacibdir — tarixlə bağlı test yalnız Bakı vaxtında keçə bilər.
- Bir addım yıxılanda sonrakılar heç işləmir; düzəldəndən sonra **bütün
  siyahını yenidən** işlət, yoxsa növbəti gizli səhv növbəti push-da çıxır.
- Push-dan sonra hesabatda açıq de: "CI nəticəsini görə bilmirəm, lokal
  təkrarı keçdi".

### Asılılıq yeniləməsindən sonra tüstü yoxlaması
Next minor yeniləməsi davranışı dəyişə bilər. Yoxlanan siyahı: bütün marşrutlar
(anonim), qorunan səhifələr kuki ilə, BFF (kuki ilə 200, kukisiz 401), CSRF
(yad `Origin` → 403), təzə tabda konsol, dil keçidi (`<html lang>`).

**Yalançı reqressiya (tutuldu):** kukisiz `/profile` 200 qaytardı — "qoruma
itib" kimi göründü. Əslində axın daxilində yönləndirmədir: gövdədə
`NEXT_REDIRECT;replace;/auth?…;307` və `<meta http-equiv="refresh">`. Production
(köhnə versiya) eyni cavabı verdi. **Anomaliyanı reqressiya adlandırmazdan əvvəl
canlı saytla müqayisə et** — tab başlığının tərcümə olunmaması və `notFound()`
200-ü də köhnə davranış çıxdı.

## 17. Lokal serverlər: preview alətləri ilə

`preview_start` `C:\FIGHTBASE\.claude\launch.json`-u oxuyur (işçi qovluq odur).
Orada `edurate-api` (qa-server, `node --env-file=backend/.env … tsx`) və
`edurate-dev` konfiqurasiyaları var. `next.config.ts`-də
`turbopack.root: process.cwd()` olduğu üçün Next dev **Edu-Rate qovluğundan**
başlamalıdır, yoxsa Turbopack "distDirRoot should not navigate out of the
projectPath" deyib panik edir (versiya səhvi deyil). Ona görə `edurate-dev`
scratchpad-dəki `edurate-dev.mjs` launcher-i işlədir (`process.chdir` + Next
bin). Scratchpad təmizlənibsə launcher-i yenidən yaz; yolda boşluq var —
`fileURLToPath` işlət, `URL.pathname` yox (`%20` verir).
