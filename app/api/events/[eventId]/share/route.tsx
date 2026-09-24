import { ImageResponse } from "next/og";
import { requestRemoteApi } from "../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ eventId: string }> };

type CampusEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  city?: string;
  startAt: string;
  organizer?: string;
  category?: string;
};

/**
 * Tədbir üçün paylaşıma hazır şəkil (Instagram story ölçüsü, 1080×1920).
 * Tələbə tədbiri hekayəsində paylaşanda EduRate də görünür — orqanik
 * cəlbetmə üçün ən ucuz kanal.
 */
export async function GET(_request: Request, context: Context) {
  const { eventId } = await context.params;

  let event: CampusEvent | undefined;
  try {
    const events = await requestRemoteApi<CampusEvent[]>("/api/events");
    event = events.find((item) => item.id === eventId);
  } catch {
    event = undefined;
  }

  if (!event) {
    return new Response("Tədbir tapılmadı.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const start = new Date(event.startAt);
  // Server UTC-də işləyir: saat qurşağı verilməsə şəkildəki vaxt Bakıdan 4 saat geri çıxırdı.
  const dateLabel = Number.isNaN(start.getTime())
    ? ""
    : new Intl.DateTimeFormat("az-AZ", { day: "numeric", month: "long", timeZone: "Asia/Baku" }).format(start);
  const timeLabel = Number.isNaN(start.getTime())
    ? ""
    : new Intl.DateTimeFormat("az-AZ", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Baku" }).format(start);
  const place = [event.location, event.city].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "110px 90px",
          backgroundColor: "#123c33",
          backgroundImage:
            "radial-gradient(circle at 82% 12%, rgba(202,234,241,0.22), transparent 55%), radial-gradient(circle at 15% 88%, rgba(158,207,143,0.20), transparent 55%)",
          color: "#eefaf1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 66,
                height: 66,
                borderRadius: 22,
                backgroundColor: "#e4f6c4",
                color: "#123c33",
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              E
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 6 }}>EDURATE</div>
          </div>
          {event.category ? (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "12px 26px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.14)",
                fontSize: 30,
                fontWeight: 600,
              }}
            >
              {event.category}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <div style={{ fontSize: 108, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            {event.title}
          </div>
          {event.description ? (
            <div style={{ fontSize: 40, lineHeight: 1.45, color: "rgba(238,250,241,0.78)" }}>
              {event.description.slice(0, 150)}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ fontSize: 60, fontWeight: 800, color: "#d8f3c6" }}>{dateLabel}</div>
            {timeLabel ? <div style={{ fontSize: 46, color: "rgba(238,250,241,0.8)" }}>{timeLabel}</div> : null}
          </div>
          {place ? <div style={{ fontSize: 38, color: "rgba(238,250,241,0.72)" }}>{place}</div> : null}
          <div
            style={{
              display: "flex",
              marginTop: 26,
              paddingTop: 30,
              borderTop: "2px solid rgba(255,255,255,0.18)",
              fontSize: 32,
              color: "rgba(238,250,241,0.6)",
            }}
          >
            Qeydiyyat və təfərrüatlar EduRate-də
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: { "Cache-Control": "public, max-age=600" },
    },
  );
}
