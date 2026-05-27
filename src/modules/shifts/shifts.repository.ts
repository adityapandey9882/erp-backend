import { randomUUID } from "node:crypto";
import {
  query,
  type DatabaseExecutor,
  withTransaction,
} from "../../database/index.js";
import { isAppRole } from "../roles/roles.types.js";
import { getUserAccountStatus, type UserAccountStatus } from "../users/users.types.js";
import type {
  EmployeeShiftAssignmentView,
  ShiftEmployeeSummary,
  ShiftView,
  ShiftWithAssignmentCount,
} from "./shifts.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type ShiftRow = {
  id: string;
  companyId: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  isActive: boolean;
  assignedEmployeeCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AssignmentRow = ShiftRow & {
  assignmentId: string;
  userId: string;
  assignedAt: Date | string;
  effectiveFrom: string;
  effectiveTo: string | null;
  fullName: string;
  email: string;
  role: string;
  isActiveUser: boolean;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  designationId: string | null;
  designationTitle: string | null;
  designationCode: string | null;
  designationDepartmentId: string | null;
  designationDepartmentName: string | null;
  designationDepartmentCode: string | null;
};

type CurrentAssignmentRow = {
  id: string;
  shiftId: string;
  effectiveFrom: string;
};

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeTime(value: string) {
  const [hours = "00", minutes = "00"] = value.split(":");

  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function mapShift(row: ShiftRow | undefined): ShiftView | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    startTime: normalizeTime(row.startTime),
    endTime: normalizeTime(row.endTime),
    graceMinutes: row.graceMinutes,
    breakMinutes: row.breakMinutes,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapShiftWithAssignmentCount(
  row: ShiftRow | undefined,
): ShiftWithAssignmentCount | null {
  const shift = mapShift(row);

  if (!shift || !row) {
    return null;
  }

  return {
    ...shift,
    assignedEmployeeCount: row.assignedEmployeeCount ?? 0,
  };
}

function toUserStatus(isActive: boolean): UserAccountStatus {
  return getUserAccountStatus(isActive);
}

function mapEmployee(row: AssignmentRow): ShiftEmployeeSummary | null {
  if (!isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.userId,
    fullName: row.fullName,
    email: row.email.toLowerCase(),
    role: row.role,
    status: toUserStatus(row.isActiveUser),
    department: row.departmentId
      ? {
          id: row.departmentId,
          name: row.departmentName ?? "Unknown Department",
          code: row.departmentCode ?? "",
        }
      : null,
    designation: row.designationId
      ? {
          id: row.designationId,
          title: row.designationTitle ?? "Unknown Designation",
          code: row.designationCode ?? "",
          department: row.designationDepartmentId
            ? {
                id: row.designationDepartmentId,
                name: row.designationDepartmentName ?? "Unknown Department",
                code: row.designationDepartmentCode ?? "",
              }
            : null,
        }
      : null,
  };
}

function mapAssignment(
  row: AssignmentRow | undefined,
): EmployeeShiftAssignmentView | null {
  if (!row) {
    return null;
  }

  const employee = mapEmployee(row);
  const shift = mapShift(row);

  if (!employee || !shift) {
    return null;
  }

  return {
    id: row.assignmentId,
    userId: row.userId,
    shiftId: row.id,
    assignedAt: toIsoString(row.assignedAt),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    employee,
    shift,
  };
}

const shiftSelect = `
  SELECT
    shifts.id,
    shifts.company_id AS "companyId",
    shifts.name,
    shifts.start_time::text AS "startTime",
    shifts.end_time::text AS "endTime",
    shifts.grace_minutes AS "graceMinutes",
    shifts.break_minutes AS "breakMinutes",
    shifts.is_active AS "isActive",
    shifts.created_at AS "createdAt",
    shifts.updated_at AS "updatedAt",
    (
      SELECT COUNT(*)::int
      FROM employee_shifts
      INNER JOIN users AS assigned_user
        ON assigned_user.id = employee_shifts.user_id
      WHERE employee_shifts.shift_id = shifts.id
        AND assigned_user.company_id = shifts.company_id
        AND assigned_user.is_active = TRUE
        AND assigned_user.role <> 'admin'
        AND employee_shifts.effective_from <= CURRENT_DATE
        AND (
          employee_shifts.effective_to IS NULL
          OR employee_shifts.effective_to >= CURRENT_DATE
        )
    ) AS "assignedEmployeeCount"
  FROM shifts
`;

const assignmentSelect = `
  SELECT
    shifts.id,
    shifts.company_id AS "companyId",
    shifts.name,
    shifts.start_time::text AS "startTime",
    shifts.end_time::text AS "endTime",
    shifts.grace_minutes AS "graceMinutes",
    shifts.break_minutes AS "breakMinutes",
    shifts.is_active AS "isActive",
    shifts.created_at AS "createdAt",
    shifts.updated_at AS "updatedAt",
    employee_shifts.id AS "assignmentId",
    employee_shifts.user_id AS "userId",
    employee_shifts.assigned_at AS "assignedAt",
    employee_shifts.effective_from::text AS "effectiveFrom",
    employee_shifts.effective_to::text AS "effectiveTo",
    assigned_user.full_name AS "fullName",
    assigned_user.email,
    assigned_user.role,
    assigned_user.is_active AS "isActiveUser",
    departments.id AS "departmentId",
    departments.name AS "departmentName",
    departments.code AS "departmentCode",
    designations.id AS "designationId",
    designations.title AS "designationTitle",
    designations.code AS "designationCode",
    designation_departments.id AS "designationDepartmentId",
    designation_departments.name AS "designationDepartmentName",
    designation_departments.code AS "designationDepartmentCode"
  FROM employee_shifts
  INNER JOIN shifts
    ON shifts.id = employee_shifts.shift_id
  INNER JOIN users AS assigned_user
    ON assigned_user.id = employee_shifts.user_id
  LEFT JOIN departments
    ON departments.id = assigned_user.department_id
    AND departments.company_id = shifts.company_id
  LEFT JOIN designations
    ON designations.id = assigned_user.designation_id
    AND designations.company_id = shifts.company_id
  LEFT JOIN departments AS designation_departments
    ON designation_departments.id = designations.department_id
    AND designation_departments.company_id = shifts.company_id
`;

async function runAssignShift(
  executor: DatabaseExecutor,
  input: {
    companyId: string;
    userId: string;
    shiftId: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  },
) {
  const currentAssignmentResult = await executor.query<CurrentAssignmentRow>(
    `
      SELECT
        id,
        shift_id AS "shiftId",
        effective_from::text AS "effectiveFrom"
      FROM employee_shifts
      WHERE user_id = $1
        AND effective_to IS NULL
      ORDER BY effective_from DESC, assigned_at DESC
      LIMIT 1
      FOR UPDATE
    `,
    [input.userId],
  );

  const currentAssignment = currentAssignmentResult.rows[0] ?? null;

  if (currentAssignment?.shiftId === input.shiftId) {
    if (currentAssignment.effectiveFrom === input.effectiveFrom) {
      return currentAssignment.id;
    }
  }

  if (currentAssignment && currentAssignment.effectiveFrom === input.effectiveFrom) {
    const result = await executor.query<{ id: string }>(
      `
        UPDATE employee_shifts
        SET
          shift_id = $2,
          assigned_at = NOW(),
          effective_to = $3::date
        WHERE id = $1
        RETURNING id
      `,
      [currentAssignment.id, input.shiftId, input.effectiveTo],
    );

    return result.rows[0]?.id ?? null;
  }

  if (currentAssignment) {
    await executor.query(
      `
        UPDATE employee_shifts
        SET effective_to = ($2::date - INTERVAL '1 day')::date
        WHERE id = $1
      `,
      [currentAssignment.id, input.effectiveFrom],
    );
  }

  const assignmentId = randomUUID();
  const result = await executor.query<{ id: string }>(
    `
      INSERT INTO employee_shifts (
        id,
        user_id,
        shift_id,
        assigned_at,
        effective_from,
        effective_to
      )
      SELECT
        $1,
        assigned_user.id,
        shifts.id,
        NOW(),
        $4::date,
        $5::date
      FROM users AS assigned_user
      INNER JOIN shifts
        ON shifts.id = $3
      WHERE assigned_user.id = $2
        AND assigned_user.company_id = $6
        AND assigned_user.is_active = TRUE
        AND assigned_user.role <> 'admin'
        AND shifts.company_id = $6
      RETURNING id
    `,
    [
      assignmentId,
      input.userId,
      input.shiftId,
      input.effectiveFrom,
      input.effectiveTo,
      input.companyId,
    ],
  );

  return result.rows[0]?.id ?? null;
}

export const shiftsRepository = {
  async listCompanyShifts(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<ShiftRow>(
      `
        ${shiftSelect}
        WHERE shifts.company_id = $1
        ORDER BY shifts.is_active DESC, shifts.start_time ASC, shifts.name ASC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapShiftWithAssignmentCount(row))
      .filter((row): row is ShiftWithAssignmentCount => row !== null);
  },

  async findShiftById(
    companyId: string,
    shiftId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<ShiftRow>(
      `
        ${shiftSelect}
        WHERE shifts.company_id = $1
          AND shifts.id = $2
        LIMIT 1
      `,
      [companyId, shiftId],
    );

    return mapShiftWithAssignmentCount(result.rows[0]);
  },

  async createShift(
    input: {
      companyId: string;
      name: string;
      startTime: string;
      endTime: string;
      graceMinutes: number;
      breakMinutes: number;
      isActive: boolean;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO shifts (
          id,
          company_id,
          name,
          start_time,
          end_time,
          grace_minutes,
          break_minutes,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4::time,
          $5::time,
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        randomUUID(),
        input.companyId,
        input.name,
        input.startTime,
        input.endTime,
        input.graceMinutes,
        input.breakMinutes,
        input.isActive,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async updateShift(
    companyId: string,
    shiftId: string,
    input: {
      name: string;
      startTime: string;
      endTime: string;
      graceMinutes: number;
      breakMinutes: number;
      isActive: boolean;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        UPDATE shifts
        SET
          name = $3,
          start_time = $4::time,
          end_time = $5::time,
          grace_minutes = $6,
          break_minutes = $7,
          is_active = $8,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        companyId,
        shiftId,
        input.name,
        input.startTime,
        input.endTime,
        input.graceMinutes,
        input.breakMinutes,
        input.isActive,
      ],
    );

    return result.rows[0]?.id ?? null;
  },

  async listCompanyShiftAssignments(
    companyId: string,
    atDate = new Date().toISOString().slice(0, 10),
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AssignmentRow>(
      `
        ${assignmentSelect}
        WHERE shifts.company_id = $1
          AND assigned_user.company_id = $1
          AND employee_shifts.effective_from <= $2::date
          AND (
            employee_shifts.effective_to IS NULL
            OR employee_shifts.effective_to >= $2::date
          )
        ORDER BY employee_shifts.effective_from DESC, assigned_user.full_name ASC
      `,
      [companyId, atDate],
    );

    return result.rows
      .map((row) => mapAssignment(row))
      .filter((row): row is EmployeeShiftAssignmentView => row !== null);
  },

  async findEmployeeShift(
    companyId: string,
    userId: string,
    atDate = new Date().toISOString().slice(0, 10),
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<AssignmentRow>(
      `
        ${assignmentSelect}
        WHERE shifts.company_id = $1
          AND assigned_user.company_id = $1
          AND employee_shifts.user_id = $2
          AND employee_shifts.effective_from <= $3::date
          AND (
            employee_shifts.effective_to IS NULL
            OR employee_shifts.effective_to >= $3::date
          )
        ORDER BY employee_shifts.effective_from DESC, employee_shifts.assigned_at DESC
        LIMIT 1
      `,
      [companyId, userId, atDate],
    );

    return mapAssignment(result.rows[0]);
  },

  async assignShift(
    input: {
      companyId: string;
      userId: string;
      shiftId: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    },
    executor?: DatabaseExecutor,
  ) {
    if (executor) {
      return runAssignShift(executor, input);
    }

    return withTransaction((client) => runAssignShift(client, input));
  },
};
