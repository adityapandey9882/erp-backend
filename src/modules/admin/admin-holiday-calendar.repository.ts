import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import {
  isHolidayType,
  type CreateHolidayRequest,
  type HolidayCalendarItem,
  type HolidayOfficeSummary,
  type UpdateHolidayRequest,
} from "./admin-holiday-calendar.types.js";

const defaultExecutor: DatabaseExecutor = { query };

type HolidayRow = {
  id: string;
  name: string;
  date: string;
  type: string;
  description: string | null;
  isActive: boolean;
  officeId: string | null;
  officeName: string | null;
  officeCity: string | null;
  officeState: string | null;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type OfficeRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function mapHoliday(row: HolidayRow | undefined): HolidayCalendarItem | null {
  if (!row || !isHolidayType(row.type)) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    date: row.date,
    day: formatDay(row.date),
    type: row.type,
    description: row.description,
    office:
      row.officeId && row.officeName
        ? {
            id: row.officeId,
            name: row.officeName,
            city: row.officeCity,
            state: row.officeState,
          }
        : null,
    status: row.isActive ? "active" : "inactive",
    createdBy: row.createdBy ?? "System Admin",
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

const holidaySelect = `
  SELECT
    company_holidays.id,
    company_holidays.name,
    company_holidays.holiday_date::text AS "date",
    company_holidays.type,
    company_holidays.description,
    company_holidays.is_active AS "isActive",
    office_locations.id AS "officeId",
    office_locations.name AS "officeName",
    office_locations.city AS "officeCity",
    office_locations.state AS "officeState",
    creator.full_name AS "createdBy",
    company_holidays.created_at AS "createdAt",
    company_holidays.updated_at AS "updatedAt"
  FROM company_holidays
  LEFT JOIN office_locations
    ON office_locations.id = company_holidays.office_location_id
   AND office_locations.company_id = company_holidays.company_id
  LEFT JOIN users creator
    ON creator.id = company_holidays.created_by
`;

export const adminHolidayCalendarRepository = {
  async listHolidays(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<HolidayRow>(
      `
        ${holidaySelect}
        WHERE company_holidays.company_id = $1
        ORDER BY company_holidays.holiday_date ASC, company_holidays.created_at ASC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapHoliday(row))
      .filter((row): row is HolidayCalendarItem => row !== null);
  },

  async listOffices(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<OfficeRow>(
      `
        SELECT id, name, city, state
        FROM office_locations
        WHERE company_id = $1
          AND is_active = TRUE
        ORDER BY is_primary DESC, name ASC
      `,
      [companyId],
    );

    return result.rows satisfies HolidayOfficeSummary[];
  },

  async findHolidayById(companyId: string, holidayId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<HolidayRow>(
      `
        ${holidaySelect}
        WHERE company_holidays.company_id = $1
          AND company_holidays.id = $2
        LIMIT 1
      `,
      [companyId, holidayId],
    );

    return mapHoliday(result.rows[0]);
  },

  async createHoliday(
    companyId: string,
    userId: string,
    input: CreateHolidayRequest,
    executor?: DatabaseExecutor,
  ) {
    const id = randomUUID();
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO company_holidays (
          id,
          company_id,
          name,
          holiday_date,
          type,
          description,
          office_location_id,
          created_by,
          updated_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $8, NOW(), NOW())
        RETURNING id
      `,
      [
        id,
        companyId,
        input.name,
        input.date,
        input.type,
        input.description ?? null,
        input.officeLocationId ?? null,
        userId,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateHoliday(
    companyId: string,
    holidayId: string,
    userId: string,
    input: UpdateHolidayRequest,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE company_holidays
        SET
          name = COALESCE($3, name),
          holiday_date = COALESCE($4::date, holiday_date),
          type = COALESCE($5, type),
          description = CASE WHEN $6::boolean THEN $7 ELSE description END,
          office_location_id = CASE WHEN $8::boolean THEN $9 ELSE office_location_id END,
          is_active = COALESCE($10, is_active),
          updated_by = $11,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        companyId,
        holidayId,
        input.name ?? null,
        input.date ?? null,
        input.type ?? null,
        Object.prototype.hasOwnProperty.call(input, "description"),
        input.description ?? null,
        Object.prototype.hasOwnProperty.call(input, "officeLocationId"),
        input.officeLocationId ?? null,
        typeof input.isActive === "boolean" ? input.isActive : null,
        userId,
      ],
    );

    return result.rows[0]?.id ?? null;
  },
};
