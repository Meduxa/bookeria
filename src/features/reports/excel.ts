import "server-only";
import writeXlsxFile from "write-excel-file/node";
import type { Report } from "./compute";

type Cell = {
  value: string | number | null;
  fontWeight?: "bold";
  format?: string;
  type?: NumberConstructor | StringConstructor;
} | null;
type T = (key: string, values?: Record<string, string | number>) => string;

const head = (...labels: string[]): Cell[] => labels.map((value) => ({ value, fontWeight: "bold" }));
const gel = (minor: number): Cell => ({ value: minor / 100, type: Number, format: "#,##0.00" });
const num = (n: number | null): Cell => ({ value: n, type: Number });
const text = (s: string): Cell => ({ value: s, type: String });

/** One workbook: summary, money, staff, services, clients. Money sheets only for people who may see money. */
export async function reportWorkbook(r: Report, opts: { t: T; money: boolean; from: string; to: string }) {
  const { t } = opts;
  const L = (k: string) => t(`reports.${k}`);
  const sheets: { name: string; rows: Cell[][] }[] = [];

  sheets.push({
    name: L("sheets.summary"),
    rows: [
      head(L("period"), `${opts.from} — ${opts.to}`),
      ...(opts.money
        ? [
            [text(L("received")), gel(r.money.receivedMinor)],
            [text(L("tips")), gel(r.money.tipsMinor)],
            [
              text(L("averageTicket")),
              r.money.averageTicketMinor === null ? null : gel(r.money.averageTicketMinor),
            ],
          ]
        : []),
      [text(L("visitsCompleted")), num(r.bookings.completed)],
      [text(L("bookingsTotal")), num(r.bookings.total)],
      [text(L("noShowRate")), num(r.bookings.noShowRatePct)],
      [text(L("cancellationRate")), num(r.bookings.cancellationRatePct)],
      [text(L("occupancy")), num(r.occupancyPct)],
      [text(L("newClients")), num(r.clients.new)],
      [text(L("returningClients")), num(r.clients.returning)],
      [text(L("retention30")), num(r.clients.retentionPct.d30)],
      [text(L("retention60")), num(r.clients.retentionPct.d60)],
      [text(L("retention90")), num(r.clients.retentionPct.d90)],
    ],
  });
  if (opts.money)
    sheets.push({
      name: L("sheets.money"),
      rows: [
        head(L("date"), L("received")),
        ...r.money.byDay.map((d) => [text(d.date), gel(d.minor)]),
        [],
        head(L("method"), L("received")),
        ...r.money.byMethod.map((m) => [text(t(`checkout.methods.${m.method}`)), gel(m.minor)]),
        [],
        head(L("category"), L("serviceValue")),
        ...r.money.byCategory.map((c) => [text(c.name || L("noCategory")), gel(c.minor)]),
      ],
    });
  sheets.push({
    name: L("sheets.staff"),
    rows: [
      head(
        L("staff"),
        ...(opts.money ? [L("serviceValue"), L("commission")] : []),
        L("bookedHours"),
        L("workingHours"),
        L("occupancy"),
      ),
      ...r.staff.map((s) => [
        text(s.name),
        ...(opts.money ? [gel(s.valueMinor), gel(s.commissionMinor)] : []),
        num(Math.round((s.bookedMinutes / 60) * 10) / 10),
        num(Math.round((s.workingMinutes / 60) * 10) / 10),
        num(s.occupancyPct),
      ]),
    ],
  });
  sheets.push({
    name: L("sheets.services"),
    rows: [
      head(L("service"), L("count"), ...(opts.money ? [L("serviceValue")] : [])),
      ...r.topServices.map((s) => [text(s.name), num(s.count), ...(opts.money ? [gel(s.valueMinor)] : [])]),
      [],
      head(L("source"), L("count")),
      ...Object.entries(r.bookings.bySource).map(([k, v]) => [text(t(`booking.sources.${k}`)), num(v)]),
      [],
      head(L("status"), L("count")),
      ...Object.entries(r.bookings.byStatus).map(([k, v]) => [text(t(`booking.status.${k}`)), num(v)]),
    ],
  });

  return (await writeXlsxFile(
    sheets.map((s) => s.rows),
    { sheets: sheets.map((s) => s.name.slice(0, 31)), buffer: true } as never,
  )) as unknown as Buffer;
}
