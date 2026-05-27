import type { HolidayCalendarItem, HolidayOfficeSummary } from "./admin-holiday-calendar.types.js";

function normalizeLocationValue(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function buildOfficeCandidates(office: HolidayOfficeSummary) {
  return [
    office.name,
    office.city,
    office.state,
    [office.city, office.state].filter(Boolean).join(" "),
    [office.name, office.city].filter(Boolean).join(" "),
    [office.name, office.state].filter(Boolean).join(" "),
  ]
    .map((value) => normalizeLocationValue(value))
    .filter((value) => value.length > 0);
}

export function isHolidayVisibleToWorkLocation(
  holiday: Pick<HolidayCalendarItem, "office">,
  workLocation: string | null | undefined,
) {
  if (!holiday.office) {
    return true;
  }

  const normalizedWorkLocation = normalizeLocationValue(workLocation);

  if (!normalizedWorkLocation) {
    return false;
  }

  return buildOfficeCandidates(holiday.office).some(
    (candidate) =>
      candidate === normalizedWorkLocation ||
      candidate.includes(normalizedWorkLocation) ||
      normalizedWorkLocation.includes(candidate),
  );
}

export function formatHolidayDateLabel(value: string) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function formatHolidayAudienceLabel(holiday: Pick<HolidayCalendarItem, "office">) {
  return holiday.office?.name ?? "all locations";
}
