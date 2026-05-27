import type { AuthenticatedUser } from "../auth/auth.types.js";
import { companiesService } from "../companies/companies.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { usersRepository } from "../users/users.repository.js";
import {
  formatHolidayAudienceLabel,
  formatHolidayDateLabel,
  isHolidayVisibleToWorkLocation,
} from "./admin-holiday-calendar.helpers.js";
import { adminSettingsRepository } from "./admin-settings.repository.js";
import { adminHolidayCalendarRepository } from "./admin-holiday-calendar.repository.js";
import type {
  AdminHolidayCalendarServiceResult,
  AdminHolidayCalendarWorkspaceResponse,
  CreateHolidayRequest,
  HolidayCalendarItem,
  HolidayMutationResponse,
  UpdateHolidayRequest,
} from "./admin-holiday-calendar.types.js";

function ok<T>(data: T): AdminHolidayCalendarServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(
  status: 403 | 404 | 409,
  message: string,
): AdminHolidayCalendarServiceResult<T> {
  return { ok: false, status, message };
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildHolidayNotificationCopy(
  holiday: HolidayCalendarItem,
  action: "created" | "updated",
) {
  const audienceLabel = formatHolidayAudienceLabel(holiday);
  const formattedDate = formatHolidayDateLabel(holiday.date);

  if (action === "created") {
    return {
      title: `Holiday added: ${holiday.name}`,
      message: `${holiday.name} has been added for ${formattedDate} at ${audienceLabel}.`,
    };
  }

  if (holiday.status === "inactive") {
    return {
      title: `Holiday removed: ${holiday.name}`,
      message: `${holiday.name} for ${formattedDate} at ${audienceLabel} is no longer active.`,
    };
  }

  return {
    title: `Holiday updated: ${holiday.name}`,
    message: `${holiday.name} is scheduled for ${formattedDate} at ${audienceLabel}. Please review the latest holiday calendar.`,
  };
}

async function notifyEmployeesAboutHolidayChange(input: {
  companyId: string;
  currentHoliday: HolidayCalendarItem;
  previousHoliday?: HolidayCalendarItem | null;
  action: "created" | "updated";
}) {
  const targets = await usersRepository.listActiveEmployeeHolidayTargets(input.companyId);
  const notifiedUserIds = targets
    .filter(
      (target) =>
        isHolidayVisibleToWorkLocation(input.currentHoliday, target.workLocation) ||
        (input.previousHoliday !== undefined &&
          input.previousHoliday !== null &&
          isHolidayVisibleToWorkLocation(input.previousHoliday, target.workLocation)),
    )
    .map((target) => target.id);

  if (notifiedUserIds.length === 0) {
    return;
  }

  const notification = buildHolidayNotificationCopy(input.currentHoliday, input.action);
  await notificationsService.notifyUsers(input.companyId, notifiedUserIds, {
    type: "holiday.calendar.updated",
    title: notification.title,
    message: notification.message,
    entityType: "company_holiday",
    entityId: input.currentHoliday.id,
  });
}

export const adminHolidayCalendarService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<AdminHolidayCalendarServiceResult<AdminHolidayCalendarWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [company, holidays, offices, attendanceSettings] = await Promise.all([
      companiesService.getCompanyView(user.companyId),
      adminHolidayCalendarRepository.listHolidays(user.companyId),
      adminHolidayCalendarRepository.listOffices(user.companyId),
      adminSettingsRepository.getAttendanceSettings(user.companyId),
    ]);

    if (!company) {
      return fail(404, "Company not found.");
    }

    const today = todayDateOnly();
    const nextMonth = addDays(today, 30);
    const monthPrefix = today.slice(0, 7);
    const activeHolidays = holidays.filter((holiday) => holiday.status === "active");

    return ok({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
      },
      attendanceSettings: {
        weeklyOffDays: attendanceSettings?.weeklyOffDays ?? ["saturday", "sunday"],
      },
      summary: {
        totalHolidays: activeHolidays.length,
        upcomingHolidays: activeHolidays.filter(
          (holiday) => holiday.date >= today && holiday.date <= nextMonth,
        ).length,
        thisMonthHolidays: activeHolidays.filter((holiday) =>
          holiday.date.startsWith(monthPrefix),
        ).length,
        optionalHolidays: activeHolidays.filter((holiday) => holiday.type === "optional")
          .length,
        restrictedHolidays: activeHolidays.filter(
          (holiday) => holiday.type === "restricted",
        ).length,
      },
      offices,
      holidays,
    });
  },

  async createHoliday(
    user: AuthenticatedUser,
    input: CreateHolidayRequest,
  ): Promise<AdminHolidayCalendarServiceResult<HolidayMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const createdId = await adminHolidayCalendarRepository.createHoliday(
      user.companyId,
      user.id,
      input,
    );

    if (!createdId) {
      return fail(409, "Unable to create holiday.");
    }

    const holiday = await adminHolidayCalendarRepository.findHolidayById(
      user.companyId,
      createdId,
    );

    if (!holiday) {
      return fail(404, "Holiday not found.");
    }

    void notifyEmployeesAboutHolidayChange({
      companyId: user.companyId,
      currentHoliday: holiday,
      action: "created",
    }).catch(() => {});

    return ok({ message: "Holiday created successfully.", holiday });
  },

  async updateHoliday(
    user: AuthenticatedUser,
    holidayId: string,
    input: UpdateHolidayRequest,
  ): Promise<AdminHolidayCalendarServiceResult<HolidayMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingHoliday = await adminHolidayCalendarRepository.findHolidayById(
      user.companyId,
      holidayId,
    );

    if (!existingHoliday) {
      return fail(404, "Holiday not found.");
    }

    const updatedId = await adminHolidayCalendarRepository.updateHoliday(
      user.companyId,
      holidayId,
      user.id,
      input,
    );

    if (!updatedId) {
      return fail(404, "Holiday not found.");
    }

    const holiday = await adminHolidayCalendarRepository.findHolidayById(
      user.companyId,
      updatedId,
    );

    if (!holiday) {
      return fail(404, "Holiday not found.");
    }

    void notifyEmployeesAboutHolidayChange({
      companyId: user.companyId,
      currentHoliday: holiday,
      previousHoliday: existingHoliday,
      action: "updated",
    }).catch(() => {});

    return ok({ message: "Holiday updated successfully.", holiday });
  },
};
