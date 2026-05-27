import type { CompanyStatus } from "../companies/companies.types.js";
import type { AdminWeekdayKey } from "./admin-settings.types.js";

export const HOLIDAY_TYPES = ["public", "company", "optional", "restricted"] as const;

export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export type HolidayOfficeSummary = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

export type HolidayCalendarItem = {
  id: string;
  name: string;
  date: string;
  day: string;
  type: HolidayType;
  description: string | null;
  office: HolidayOfficeSummary | null;
  status: "active" | "inactive";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminHolidayCalendarWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    status: CompanyStatus;
  };
  attendanceSettings: {
    weeklyOffDays: AdminWeekdayKey[];
  };
  summary: {
    totalHolidays: number;
    upcomingHolidays: number;
    thisMonthHolidays: number;
    optionalHolidays: number;
    restrictedHolidays: number;
  };
  offices: HolidayOfficeSummary[];
  holidays: HolidayCalendarItem[];
};

export type CreateHolidayRequest = {
  name: string;
  date: string;
  type: HolidayType;
  description?: string | null;
  officeLocationId?: string | null;
};

export type UpdateHolidayRequest = Partial<CreateHolidayRequest> & {
  isActive?: boolean;
};

export type HolidayMutationResponse = {
  message: string;
  holiday: HolidayCalendarItem;
};

export type AdminHolidayCalendarServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type AdminHolidayCalendarServiceFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type AdminHolidayCalendarServiceResult<T> =
  | AdminHolidayCalendarServiceSuccess<T>
  | AdminHolidayCalendarServiceFailure;

export function isHolidayType(value: string): value is HolidayType {
  return HOLIDAY_TYPES.includes(value as HolidayType);
}
