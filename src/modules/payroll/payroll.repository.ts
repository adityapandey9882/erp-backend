import { randomUUID } from "node:crypto";
import { query, type DatabaseExecutor } from "../../database/index.js";
import type {
  CreateSalaryStructureInput,
  PayrollRecordView,
  PayrollRunDetail,
  PayrollRunStatus,
  PayrollRunSummary,
  SalaryStructureView,
  SalaryStructureStatus,
  UpdateSalaryStructureInput,
} from "./payroll.types.js";
import { isPayrollRunStatus, isSalaryStructureStatus } from "./payroll.types.js";

const defaultExecutor: DatabaseExecutor = {
  query,
};

type SalaryStructureRow = {
  id: string;
  designationId: string;
  designationTitle: string;
  designationCode: string;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  baseAmount: string | number;
  currencyCode: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type PayrollRunRow = {
  id: string;
  companyId: string;
  month: number;
  year: number;
  status: string;
  employeeCount: number | string | null;
  totalBaseSalary: number | string | null;
  totalFinalSalary: number | string | null;
  createdAt: Date | string;
};

type PayrollRecordRow = {
  id: string;
  runId: string;
  userId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  designationId: string | null;
  designationTitle: string | null;
  designationCode: string | null;
  designationDepartmentId: string | null;
  designationDepartmentName: string | null;
  designationDepartmentCode: string | null;
  baseSalary: string | number;
  finalSalary: string | number;
  createdAt: Date | string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function resolveExecutor(executor?: DatabaseExecutor) {
  return executor ?? defaultExecutor;
}

function mapSalaryStructure(
  row: SalaryStructureRow | undefined,
): SalaryStructureView | null {
  if (
    !row ||
    !row.designationId ||
    !row.designationTitle ||
    !row.designationCode ||
    !isSalaryStructureStatus(row.status)
  ) {
    return null;
  }

  return {
    id: row.id,
    designation: {
      id: row.designationId,
      title: row.designationTitle,
      code: row.designationCode,
      department: row.departmentId
        ? {
            id: row.departmentId,
            name: row.departmentName ?? "Unknown Department",
            code: row.departmentCode ?? "",
          }
        : null,
    },
    baseAmount: toNumber(row.baseAmount),
    currencyCode: row.currencyCode,
    status: row.status,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function formatPayrollPeriod(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function mapPayrollRun(row: PayrollRunRow | undefined): PayrollRunSummary | null {
  if (!row || !isPayrollRunStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    month: Number(row.month),
    year: Number(row.year),
    status: row.status,
    employeeCount: Number(row.employeeCount ?? 0),
    totalBaseSalary: toNumber(row.totalBaseSalary ?? 0),
    totalFinalSalary: toNumber(row.totalFinalSalary ?? 0),
    createdAt: toIsoString(row.createdAt),
  };
}

function mapPayrollRecord(
  row: PayrollRecordRow | undefined,
  reference: PayrollRecordView["reference"],
  currencyCode: string,
): PayrollRecordView | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    runId: row.runId,
    userId: row.userId,
    employee: {
      id: row.userId,
      fullName: row.fullName,
      email: row.email.toLowerCase(),
      status: row.isActive ? "active" : "inactive",
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
                  name:
                    row.designationDepartmentName ?? "Unknown Department",
                  code: row.designationDepartmentCode ?? "",
                }
              : null,
          }
        : null,
    },
    baseSalary: toNumber(row.baseSalary),
    finalSalary: toNumber(row.finalSalary),
    currencyCode,
    reference,
    createdAt: toIsoString(row.createdAt),
  };
}

const salaryStructureSelect = `
  SELECT
    salary_structures.id,
    designations.id AS "designationId",
    designations.title AS "designationTitle",
    designations.code AS "designationCode",
    departments.id AS "departmentId",
    departments.name AS "departmentName",
    departments.code AS "departmentCode",
    salary_structures.base_amount AS "baseAmount",
    salary_structures.currency_code AS "currencyCode",
    salary_structures.status,
    salary_structures.created_at AS "createdAt",
    salary_structures.updated_at AS "updatedAt"
  FROM salary_structures
  INNER JOIN designations
    ON designations.id = salary_structures.designation_id
    AND designations.company_id = salary_structures.company_id
  LEFT JOIN departments
    ON departments.id = designations.department_id
    AND departments.company_id = salary_structures.company_id
`;

const payrollRunSelect = `
  SELECT
    payroll_runs.id,
    payroll_runs.company_id AS "companyId",
    payroll_runs.month,
    payroll_runs.year,
    payroll_runs.status,
    payroll_runs.created_at AS "createdAt",
    COUNT(payroll_records.id)::int AS "employeeCount",
    COALESCE(SUM(payroll_records.base_salary), 0) AS "totalBaseSalary",
    COALESCE(SUM(payroll_records.final_salary), 0) AS "totalFinalSalary"
  FROM payroll_runs
  LEFT JOIN payroll_records
    ON payroll_records.run_id = payroll_runs.id
`;

const payrollRecordSelect = `
  SELECT
    payroll_records.id,
    payroll_records.run_id AS "runId",
    payroll_records.user_id AS "userId",
    users.full_name AS "fullName",
    users.email,
    users.is_active AS "isActive",
    departments.id AS "departmentId",
    departments.name AS "departmentName",
    departments.code AS "departmentCode",
    designations.id AS "designationId",
    designations.title AS "designationTitle",
    designations.code AS "designationCode",
    designation_departments.id AS "designationDepartmentId",
    designation_departments.name AS "designationDepartmentName",
    designation_departments.code AS "designationDepartmentCode",
    payroll_records.base_salary AS "baseSalary",
    payroll_records.final_salary AS "finalSalary",
    payroll_records.created_at AS "createdAt"
  FROM payroll_records
  INNER JOIN users
    ON users.id = payroll_records.user_id
  LEFT JOIN departments
    ON departments.id = users.department_id
    AND departments.company_id = users.company_id
  LEFT JOIN designations
    ON designations.id = users.designation_id
    AND designations.company_id = users.company_id
  LEFT JOIN departments AS designation_departments
    ON designation_departments.id = designations.department_id
    AND designation_departments.company_id = users.company_id
`;

export const payrollRepository = {
  async listCompanySalaryStructures(
    companyId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<SalaryStructureRow>(
      `
        ${salaryStructureSelect}
        WHERE salary_structures.company_id = $1
        ORDER BY designations.title ASC, salary_structures.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapSalaryStructure(row))
      .filter((row): row is SalaryStructureView => row !== null);
  },

  async findCompanySalaryStructureById(
    companyId: string,
    structureId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<SalaryStructureRow>(
      `
        ${salaryStructureSelect}
        WHERE salary_structures.company_id = $1
          AND salary_structures.id = $2
        LIMIT 1
      `,
      [companyId, structureId],
    );

    return mapSalaryStructure(result.rows[0]);
  },

  async findCompanySalaryStructureByDesignationId(
    companyId: string,
    designationId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<SalaryStructureRow>(
      `
        ${salaryStructureSelect}
        WHERE salary_structures.company_id = $1
          AND salary_structures.designation_id = $2
        LIMIT 1
      `,
      [companyId, designationId],
    );

    return mapSalaryStructure(result.rows[0]);
  },

  async createSalaryStructure(
    input: CreateSalaryStructureInput,
    executor?: DatabaseExecutor,
  ) {
    const resolvedExecutor = resolveExecutor(executor);
    const result = await resolvedExecutor.query<{ id: string }>(
      `
        INSERT INTO salary_structures (
          id,
          company_id,
          designation_id,
          base_amount,
          currency_code,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `,
      [
        randomUUID(),
        input.companyId,
        input.designationId,
        input.baseAmount,
        input.currencyCode,
        input.status,
      ],
    );

    const insertedId = result.rows[0]?.id;

    if (!insertedId) {
      return null;
    }

    return this.findCompanySalaryStructureById(
      input.companyId,
      insertedId,
      resolvedExecutor,
    );
  },

  async updateSalaryStructure(
    companyId: string,
    structureId: string,
    input: UpdateSalaryStructureInput,
    executor?: DatabaseExecutor,
  ) {
    const resolvedExecutor = resolveExecutor(executor);
    const result = await resolvedExecutor.query<{ id: string }>(
      `
        UPDATE salary_structures
        SET
          base_amount = $3,
          currency_code = $4,
          status = $5,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        companyId,
        structureId,
        input.baseAmount,
        input.currencyCode,
        input.status,
      ],
    );

    const updatedId = result.rows[0]?.id;

    if (!updatedId) {
      return null;
    }

    return this.findCompanySalaryStructureById(
      companyId,
      updatedId,
      resolvedExecutor,
    );
  },

  async listCompanyPayrollRuns(companyId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<PayrollRunRow>(
      `
        ${payrollRunSelect}
        WHERE payroll_runs.company_id = $1
        GROUP BY payroll_runs.id
        ORDER BY payroll_runs.year DESC, payroll_runs.month DESC, payroll_runs.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapPayrollRun(row))
      .filter((row): row is PayrollRunSummary => row !== null);
  },

  async findCompanyPayrollRunById(
    companyId: string,
    runId: string,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<PayrollRunRow>(
      `
        ${payrollRunSelect}
        WHERE payroll_runs.company_id = $1
          AND payroll_runs.id = $2
        GROUP BY payroll_runs.id
        LIMIT 1
      `,
      [companyId, runId],
    );

    return mapPayrollRun(result.rows[0]);
  },

  async findCompanyPayrollRunByPeriod(
    companyId: string,
    month: number,
    year: number,
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<PayrollRunRow>(
      `
        ${payrollRunSelect}
        WHERE payroll_runs.company_id = $1
          AND payroll_runs.month = $2
          AND payroll_runs.year = $3
        GROUP BY payroll_runs.id
        LIMIT 1
      `,
      [companyId, month, year],
    );

    return mapPayrollRun(result.rows[0]);
  },

  async createPayrollRun(
    input: {
      companyId: string;
      month: number;
      year: number;
      status: PayrollRunStatus;
    },
    executor?: DatabaseExecutor,
  ) {
    const result = await resolveExecutor(executor).query<{ id: string }>(
      `
        INSERT INTO payroll_runs (
          id,
          company_id,
          month,
          year,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `,
      [randomUUID(), input.companyId, input.month, input.year, input.status],
    );

    return result.rows[0]?.id ?? null;
  },

  async createPayrollRecords(
    records: readonly {
      runId: string;
      userId: string;
      baseSalary: number;
      finalSalary: number;
    }[],
    executor?: DatabaseExecutor,
  ) {
    for (const record of records) {
      await resolveExecutor(executor).query(
        `
          INSERT INTO payroll_records (
            id,
            run_id,
            user_id,
            base_salary,
            final_salary,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `,
        [
          randomUUID(),
          record.runId,
          record.userId,
          record.baseSalary,
          record.finalSalary,
        ],
      );
    }
  },

  async listPayrollRecordRowsForRun(runId: string, executor?: DatabaseExecutor) {
    const result = await resolveExecutor(executor).query<PayrollRecordRow>(
      `
        ${payrollRecordSelect}
        WHERE payroll_records.run_id = $1
        ORDER BY users.full_name ASC
      `,
      [runId],
    );

    return result.rows;
  },

  mapPayrollRecord,

  buildPayrollRunDetail(
    run: PayrollRunSummary,
    records: PayrollRecordView[],
  ): PayrollRunDetail {
    return {
      ...run,
      period: {
        month: run.month,
        year: run.year,
        label: formatPayrollPeriod(run.month, run.year),
      },
      records,
    };
  },
};
