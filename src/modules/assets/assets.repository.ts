import { randomUUID } from "node:crypto";
import type { DatabaseExecutor } from "../../database/index.js";
import { query } from "../../database/index.js";
import type {
  AssetEventRecord,
  AssetEventType,
  AssetProcurementItemRecord,
  AssetProcurementLinkedAssetRecord,
  AssetProcurementRecord,
  AssetRecord,
  AssetStatus,
  CreateAssetInput,
  CreateAssetProcurementInput,
  UpdateAssetInput,
} from "./assets.types.js";
import { isAssetEventType, isAssetStatus } from "./assets.types.js";

type AssetRow = {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  serialNumber: string | null;
  brandModel: string | null;
  purchaseDate: Date | string | null;
  warrantyExpiry: Date | string | null;
  conditionLabel: string;
  status: string;
  assignedToUserId: string | null;
  assignedAt: Date | string | null;
  returnedAt: Date | string | null;
  expectedReturnDate: Date | string | null;
  assignmentCondition: string | null;
  assignmentNotes: string | null;
  notes: string | null;
  procurementItemId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AssetEventRow = {
  id: string;
  companyId: string;
  assetId: string;
  type: string;
  notes: string | null;
  actorUserId: string | null;
  createdAt: Date | string;
};

type AssetProcurementRow = {
  id: string;
  companyId: string;
  vendorName: string;
  invoiceNumber: string | null;
  purchaseDate: Date | string;
  totalAmount: string | number;
  notes: string | null;
  createdAt: Date | string;
};

type AssetProcurementItemRow = {
  id: string;
  procurementId: string;
  name: string;
  category: string;
  quantity: number | string;
  unitPrice: number | string;
  createdAt: Date | string;
};

type AssetProcurementLinkedAssetRow = {
  id: string;
  procurementItemId: string;
  assetCode: string;
  name: string;
  category: string;
  status: string;
  createdAt: Date | string;
};

type AssetProcurementSummaryRow = AssetProcurementRow & {
  itemLineCount: number | string;
  itemQuantityTotal: number | string;
  createdAssetsCount: number | string;
};

const defaultExecutor: DatabaseExecutor = { query };

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnlyString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function toDateOnlyStringOrNull(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return toDateOnlyString(value);
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function mapAssetRecord(row: AssetRow | undefined): AssetRecord | null {
  if (!row || !isAssetStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    assetCode: row.assetCode,
    name: row.name,
    category: row.category,
    serialNumber: row.serialNumber,
    brandModel: row.brandModel,
    purchaseDate: toDateOnlyStringOrNull(row.purchaseDate),
    warrantyExpiry: toDateOnlyStringOrNull(row.warrantyExpiry),
    conditionLabel: row.conditionLabel,
    status: row.status,
    assignedToUserId: row.assignedToUserId,
    assignedAt: toIsoString(row.assignedAt),
    returnedAt: toIsoString(row.returnedAt),
    expectedReturnDate: toDateOnlyStringOrNull(row.expectedReturnDate),
    assignmentCondition: row.assignmentCondition,
    assignmentNotes: row.assignmentNotes,
    notes: row.notes,
    procurementItemId: row.procurementItemId,
    createdAt: toIsoString(row.createdAt) ?? "",
    updatedAt: toIsoString(row.updatedAt) ?? "",
  };
}

function mapAssetEventRecord(row: AssetEventRow | undefined): AssetEventRecord | null {
  if (!row || !isAssetEventType(row.type)) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    assetId: row.assetId,
    type: row.type,
    notes: row.notes,
    actorUserId: row.actorUserId,
    createdAt: toIsoString(row.createdAt) ?? "",
  };
}

function mapAssetProcurementRecord(
  row: AssetProcurementRow | undefined,
): AssetProcurementRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    vendorName: row.vendorName,
    invoiceNumber: row.invoiceNumber,
    purchaseDate: toDateOnlyString(row.purchaseDate),
    totalAmount: toNumber(row.totalAmount),
    notes: row.notes,
    createdAt: toIsoString(row.createdAt) ?? "",
  };
}

function mapAssetProcurementItemRecord(
  row: AssetProcurementItemRow | undefined,
): AssetProcurementItemRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    procurementId: row.procurementId,
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity),
    unitPrice: toNumber(row.unitPrice),
    createdAt: toIsoString(row.createdAt) ?? "",
  };
}

function mapAssetProcurementLinkedAssetRecord(
  row: AssetProcurementLinkedAssetRow | undefined,
): AssetProcurementLinkedAssetRecord | null {
  if (!row || !isAssetStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    procurementItemId: row.procurementItemId,
    assetCode: row.assetCode,
    name: row.name,
    category: row.category,
    status: row.status,
    createdAt: toIsoString(row.createdAt) ?? "",
  };
}

function mapAssetProcurementSummaryRow(row: AssetProcurementSummaryRow | undefined) {
  if (!row) {
    return null;
  }

  const procurement = mapAssetProcurementRecord(row);

  if (!procurement) {
    return null;
  }

  return {
    ...procurement,
    itemLineCount: Number(row.itemLineCount),
    itemQuantityTotal: Number(row.itemQuantityTotal),
    createdAssetsCount: Number(row.createdAssetsCount),
  };
}

const assetSelect = `
  SELECT
    id,
    asset_code AS "assetCode",
    name,
    category,
    serial_number AS "serialNumber",
    brand_model AS "brandModel",
    purchase_date AS "purchaseDate",
    warranty_expiry AS "warrantyExpiry",
    condition_label AS "conditionLabel",
    status,
    assigned_to_user_id AS "assignedToUserId",
    assigned_at AS "assignedAt",
    returned_at AS "returnedAt",
    expected_return_date AS "expectedReturnDate",
    assignment_condition AS "assignmentCondition",
    assignment_notes AS "assignmentNotes",
    notes,
    procurement_item_id AS "procurementItemId",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM company_assets
`;

const assetEventSelect = `
  SELECT
    id,
    company_id AS "companyId",
    asset_id AS "assetId",
    type,
    notes,
    actor_user_id AS "actorUserId",
    created_at AS "createdAt"
  FROM asset_events
`;

const assetProcurementSelect = `
  SELECT
    id,
    company_id AS "companyId",
    vendor_name AS "vendorName",
    invoice_number AS "invoiceNumber",
    purchase_date AS "purchaseDate",
    total_amount AS "totalAmount",
    notes,
    created_at AS "createdAt"
  FROM asset_procurements
`;

const assetProcurementItemSelect = `
  SELECT
    asset_procurement_items.id,
    asset_procurement_items.procurement_id AS "procurementId",
    asset_procurement_items.name,
    asset_procurement_items.category,
    asset_procurement_items.quantity,
    asset_procurement_items.unit_price AS "unitPrice",
    asset_procurement_items.created_at AS "createdAt"
  FROM asset_procurement_items
`;

const procurementLinkedAssetSelect = `
  SELECT
    company_assets.id,
    company_assets.procurement_item_id AS "procurementItemId",
    company_assets.asset_code AS "assetCode",
    company_assets.name,
    company_assets.category,
    company_assets.status,
    company_assets.created_at AS "createdAt"
  FROM company_assets
`;

const assetProcurementSummarySelect = `
  SELECT
    asset_procurements.id,
    asset_procurements.company_id AS "companyId",
    asset_procurements.vendor_name AS "vendorName",
    asset_procurements.invoice_number AS "invoiceNumber",
    asset_procurements.purchase_date AS "purchaseDate",
    asset_procurements.total_amount AS "totalAmount",
    asset_procurements.notes,
    asset_procurements.created_at AS "createdAt",
    COALESCE(item_stats.item_line_count, 0) AS "itemLineCount",
    COALESCE(item_stats.item_quantity_total, 0) AS "itemQuantityTotal",
    COALESCE(asset_stats.created_assets_count, 0) AS "createdAssetsCount"
  FROM asset_procurements
  LEFT JOIN (
    SELECT
      procurement_id,
      COUNT(*) AS item_line_count,
      COALESCE(SUM(quantity), 0) AS item_quantity_total
    FROM asset_procurement_items
    GROUP BY procurement_id
  ) AS item_stats
    ON item_stats.procurement_id = asset_procurements.id
  LEFT JOIN (
    SELECT
      asset_procurement_items.procurement_id,
      COUNT(company_assets.id) AS created_assets_count
    FROM asset_procurement_items
    LEFT JOIN company_assets
      ON company_assets.procurement_item_id = asset_procurement_items.id
    GROUP BY asset_procurement_items.procurement_id
  ) AS asset_stats
    ON asset_stats.procurement_id = asset_procurements.id
`;

export const assetsRepository = {
  async listCompanyAssets(companyId: string, executor: DatabaseExecutor = defaultExecutor) {
    const result = await executor.query<AssetRow>(
      `
        ${assetSelect}
        WHERE company_id = $1
        ORDER BY updated_at DESC, created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapAssetRecord(row))
      .filter((row): row is AssetRecord => row !== null);
  },

  async listAssetsAssignedToUser(
    companyId: string,
    userId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        ${assetSelect}
        WHERE company_id = $1
          AND assigned_to_user_id = $2
        ORDER BY assigned_at DESC NULLS LAST, updated_at DESC, created_at DESC
      `,
      [companyId, userId],
    );

    return result.rows
      .map((row) => mapAssetRecord(row))
      .filter((row): row is AssetRecord => row !== null);
  },

  async findCompanyAssetById(
    companyId: string,
    assetId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        ${assetSelect}
        WHERE company_id = $1
          AND id = $2
        LIMIT 1
      `,
      [companyId, assetId],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async findCompanyAssetByCode(
    companyId: string,
    assetCode: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        ${assetSelect}
        WHERE company_id = $1
          AND LOWER(asset_code) = LOWER($2)
        LIMIT 1
      `,
      [companyId, assetCode],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async findCompanyAssetBySerialNumber(
    companyId: string,
    serialNumber: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        ${assetSelect}
        WHERE company_id = $1
          AND LOWER(serial_number) = LOWER($2)
        LIMIT 1
      `,
      [companyId, serialNumber],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async createAsset(
    input: CreateAssetInput,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        INSERT INTO company_assets (
          id,
          company_id,
          asset_code,
          name,
          category,
          serial_number,
          brand_model,
          purchase_date,
          warranty_expiry,
          condition_label,
          status,
          expected_return_date,
          assignment_condition,
          assignment_notes,
          notes,
          procurement_item_id,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::date,
          $9::date,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          asset_code AS "assetCode",
          name,
          category,
          serial_number AS "serialNumber",
          brand_model AS "brandModel",
          purchase_date AS "purchaseDate",
          warranty_expiry AS "warrantyExpiry",
          condition_label AS "conditionLabel",
          status,
          assigned_to_user_id AS "assignedToUserId",
          assigned_at AS "assignedAt",
          returned_at AS "returnedAt",
          expected_return_date AS "expectedReturnDate",
          assignment_condition AS "assignmentCondition",
          assignment_notes AS "assignmentNotes",
          notes,
          procurement_item_id AS "procurementItemId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        randomUUID(),
        input.companyId,
        input.assetCode,
        input.name,
        input.category,
        input.serialNumber ?? null,
        input.brandModel ?? null,
        input.purchaseDate ?? null,
        input.warrantyExpiry ?? null,
        input.conditionLabel,
        input.status,
        input.expectedReturnDate ?? null,
        input.assignmentCondition ?? null,
        input.assignmentNotes ?? null,
        input.notes ?? null,
        input.procurementItemId ?? null,
      ],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async updateAsset(
    companyId: string,
    assetId: string,
    input: UpdateAssetInput,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        UPDATE company_assets
        SET
          asset_code = $3,
          name = $4,
          category = $5,
          serial_number = $6,
          brand_model = $7,
          purchase_date = $8::date,
          warranty_expiry = $9::date,
          condition_label = $10,
          status = $11,
          notes = $12,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          id,
          asset_code AS "assetCode",
          name,
          category,
          serial_number AS "serialNumber",
          brand_model AS "brandModel",
          purchase_date AS "purchaseDate",
          warranty_expiry AS "warrantyExpiry",
          condition_label AS "conditionLabel",
          status,
          assigned_to_user_id AS "assignedToUserId",
          assigned_at AS "assignedAt",
          returned_at AS "returnedAt",
          expected_return_date AS "expectedReturnDate",
          assignment_condition AS "assignmentCondition",
          assignment_notes AS "assignmentNotes",
          notes,
          procurement_item_id AS "procurementItemId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        assetId,
        input.assetCode,
        input.name,
        input.category,
        input.serialNumber ?? null,
        input.brandModel ?? null,
        input.purchaseDate ?? null,
        input.warrantyExpiry ?? null,
        input.conditionLabel,
        input.status,
        input.notes ?? null,
      ],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async updateAssetStatus(
    companyId: string,
    assetId: string,
    input: {
      status: AssetStatus;
      notes?: string | null;
    },
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const shouldUpdateNotes = input.notes !== undefined;
    const result = await executor.query<AssetRow>(
      `
        UPDATE company_assets
        SET
          status = $3,
          notes = CASE WHEN $4 THEN $5 ELSE notes END,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          id,
          asset_code AS "assetCode",
          name,
          category,
          serial_number AS "serialNumber",
          brand_model AS "brandModel",
          purchase_date AS "purchaseDate",
          warranty_expiry AS "warrantyExpiry",
          condition_label AS "conditionLabel",
          status,
          assigned_to_user_id AS "assignedToUserId",
          assigned_at AS "assignedAt",
          returned_at AS "returnedAt",
          expected_return_date AS "expectedReturnDate",
          assignment_condition AS "assignmentCondition",
          assignment_notes AS "assignmentNotes",
          notes,
          procurement_item_id AS "procurementItemId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [companyId, assetId, input.status, shouldUpdateNotes, input.notes ?? null],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async updateAssetNotes(
    companyId: string,
    assetId: string,
    notes: string | null,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        UPDATE company_assets
        SET
          notes = $3,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          id,
          asset_code AS "assetCode",
          name,
          category,
          serial_number AS "serialNumber",
          brand_model AS "brandModel",
          purchase_date AS "purchaseDate",
          warranty_expiry AS "warrantyExpiry",
          condition_label AS "conditionLabel",
          status,
          assigned_to_user_id AS "assignedToUserId",
          assigned_at AS "assignedAt",
          returned_at AS "returnedAt",
          expected_return_date AS "expectedReturnDate",
          assignment_condition AS "assignmentCondition",
          assignment_notes AS "assignmentNotes",
          notes,
          procurement_item_id AS "procurementItemId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [companyId, assetId, notes],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async assignAsset(
    companyId: string,
    assetId: string,
    input: {
      userId: string;
      expectedReturnDate?: string | null;
      conditionAtAssignment?: string | null;
      notes?: string | null;
    },
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        UPDATE company_assets
        SET
          status = 'assigned',
          assigned_to_user_id = $3,
          assigned_at = NOW(),
          returned_at = NULL,
          expected_return_date = $4::date,
          assignment_condition = $5,
          assignment_notes = $6,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          id,
          asset_code AS "assetCode",
          name,
          category,
          serial_number AS "serialNumber",
          brand_model AS "brandModel",
          purchase_date AS "purchaseDate",
          warranty_expiry AS "warrantyExpiry",
          condition_label AS "conditionLabel",
          status,
          assigned_to_user_id AS "assignedToUserId",
          assigned_at AS "assignedAt",
          returned_at AS "returnedAt",
          expected_return_date AS "expectedReturnDate",
          assignment_condition AS "assignmentCondition",
          assignment_notes AS "assignmentNotes",
          notes,
          procurement_item_id AS "procurementItemId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        companyId,
        assetId,
        input.userId,
        input.expectedReturnDate ?? null,
        input.conditionAtAssignment ?? null,
        input.notes ?? null,
      ],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async returnAsset(
    companyId: string,
    assetId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetRow>(
      `
        UPDATE company_assets
        SET
          status = 'returned',
          assigned_to_user_id = NULL,
          returned_at = NOW(),
          expected_return_date = NULL,
          assignment_condition = NULL,
          assignment_notes = NULL,
          updated_at = NOW()
        WHERE company_id = $1
          AND id = $2
        RETURNING
          id,
          asset_code AS "assetCode",
          name,
          category,
          serial_number AS "serialNumber",
          brand_model AS "brandModel",
          purchase_date AS "purchaseDate",
          warranty_expiry AS "warrantyExpiry",
          condition_label AS "conditionLabel",
          status,
          assigned_to_user_id AS "assignedToUserId",
          assigned_at AS "assignedAt",
          returned_at AS "returnedAt",
          expected_return_date AS "expectedReturnDate",
          assignment_condition AS "assignmentCondition",
          assignment_notes AS "assignmentNotes",
          notes,
          procurement_item_id AS "procurementItemId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [companyId, assetId],
    );

    return mapAssetRecord(result.rows[0]);
  },

  async listAssetEvents(
    companyId: string,
    assetId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetEventRow>(
      `
        ${assetEventSelect}
        WHERE company_id = $1
          AND asset_id = $2
        ORDER BY created_at DESC, id DESC
      `,
      [companyId, assetId],
    );

    return result.rows
      .map((row) => mapAssetEventRecord(row))
      .filter((row): row is AssetEventRecord => row !== null);
  },

  async createAssetEvent(
    input: {
      companyId: string;
      assetId: string;
      type: AssetEventType;
      notes?: string | null;
      actorUserId?: string | null;
      createdAt?: string | null;
    },
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetEventRow>(
      `
        INSERT INTO asset_events (
          id,
          company_id,
          asset_id,
          type,
          notes,
          actor_user_id,
          created_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          COALESCE($7::timestamptz, NOW())
        )
        RETURNING
          id,
          company_id AS "companyId",
          asset_id AS "assetId",
          type,
          notes,
          actor_user_id AS "actorUserId",
          created_at AS "createdAt"
      `,
      [
        randomUUID(),
        input.companyId,
        input.assetId,
        input.type,
        input.notes ?? null,
        input.actorUserId ?? null,
        input.createdAt ?? null,
      ],
    );

    return mapAssetEventRecord(result.rows[0]);
  },

  async listCompanyProcurements(
    companyId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetProcurementRow>(
      `
        ${assetProcurementSelect}
        WHERE company_id = $1
        ORDER BY purchase_date DESC, created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapAssetProcurementRecord(row))
      .filter((row): row is AssetProcurementRecord => row !== null);
  },

  async listCompanyProcurementSummaries(
    companyId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetProcurementSummaryRow>(
      `
        ${assetProcurementSummarySelect}
        WHERE asset_procurements.company_id = $1
        ORDER BY asset_procurements.purchase_date DESC, asset_procurements.created_at DESC
      `,
      [companyId],
    );

    return result.rows
      .map((row) => mapAssetProcurementSummaryRow(row))
      .filter(
        (
          row,
        ): row is AssetProcurementRecord & {
          itemLineCount: number;
          itemQuantityTotal: number;
          createdAssetsCount: number;
        } => row !== null,
      );
  },

  async findCompanyProcurementById(
    companyId: string,
    procurementId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetProcurementRow>(
      `
        ${assetProcurementSelect}
        WHERE company_id = $1
          AND id = $2
        LIMIT 1
      `,
      [companyId, procurementId],
    );

    return mapAssetProcurementRecord(result.rows[0]);
  },

  async findCompanyProcurementByInvoiceNumber(
    companyId: string,
    invoiceNumber: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetProcurementRow>(
      `
        ${assetProcurementSelect}
        WHERE company_id = $1
          AND LOWER(invoice_number) = LOWER($2)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [companyId, invoiceNumber],
    );

    return mapAssetProcurementRecord(result.rows[0]);
  },

  async lockCompanyProcurementForUpdate(
    companyId: string,
    procurementId: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const result = await executor.query<AssetProcurementRow>(
      `
        ${assetProcurementSelect}
        WHERE company_id = $1
          AND id = $2
        LIMIT 1
        FOR UPDATE
      `,
      [companyId, procurementId],
    );

    return mapAssetProcurementRecord(result.rows[0]);
  },

  async listProcurementItems(
    companyId: string,
    procurementId?: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const params = procurementId ? [companyId, procurementId] : [companyId];
    const whereClause = procurementId
      ? "WHERE asset_procurements.company_id = $1 AND asset_procurement_items.procurement_id = $2"
      : "WHERE asset_procurements.company_id = $1";

    const result = await executor.query<AssetProcurementItemRow>(
      `
        ${assetProcurementItemSelect}
        INNER JOIN asset_procurements
          ON asset_procurements.id = asset_procurement_items.procurement_id
        ${whereClause}
        ORDER BY asset_procurement_items.created_at ASC, asset_procurement_items.id ASC
      `,
      params,
    );

    return result.rows
      .map((row) => mapAssetProcurementItemRecord(row))
      .filter((row): row is AssetProcurementItemRecord => row !== null);
  },

  async listProcurementLinkedAssets(
    companyId: string,
    procurementId?: string,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const params = procurementId ? [companyId, procurementId] : [companyId];
    const whereClause = procurementId
      ? "WHERE asset_procurements.company_id = $1 AND asset_procurements.id = $2"
      : "WHERE asset_procurements.company_id = $1";

    const result = await executor.query<AssetProcurementLinkedAssetRow>(
      `
        ${procurementLinkedAssetSelect}
        INNER JOIN asset_procurement_items
          ON asset_procurement_items.id = company_assets.procurement_item_id
        INNER JOIN asset_procurements
          ON asset_procurements.id = asset_procurement_items.procurement_id
        ${whereClause}
        ORDER BY company_assets.created_at DESC, company_assets.id DESC
      `,
      params,
    );

    return result.rows
      .map((row) => mapAssetProcurementLinkedAssetRecord(row))
      .filter((row): row is AssetProcurementLinkedAssetRecord => row !== null);
  },

  async createProcurement(
    input: CreateAssetProcurementInput,
    executor: DatabaseExecutor = defaultExecutor,
  ) {
    const procurementResult = await executor.query<AssetProcurementRow>(
      `
        INSERT INTO asset_procurements (
          id,
          company_id,
          vendor_name,
          invoice_number,
          purchase_date,
          total_amount,
          notes,
          created_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::date,
          $6,
          $7,
          NOW()
        )
        RETURNING
          id,
          company_id AS "companyId",
          vendor_name AS "vendorName",
          invoice_number AS "invoiceNumber",
          purchase_date AS "purchaseDate",
          total_amount AS "totalAmount",
          notes,
          created_at AS "createdAt"
      `,
      [
        randomUUID(),
        input.companyId,
        input.vendorName,
        input.invoiceNumber ?? null,
        input.purchaseDate,
        input.totalAmount,
        input.notes ?? null,
      ],
    );

    const procurement = mapAssetProcurementRecord(procurementResult.rows[0]);

    if (!procurement) {
      return null;
    }

    const items: AssetProcurementItemRecord[] = [];

    for (const item of input.items) {
      const itemResult = await executor.query<AssetProcurementItemRow>(
        `
          INSERT INTO asset_procurement_items (
            id,
            procurement_id,
            name,
            category,
            quantity,
            unit_price,
            created_at
          ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            NOW()
          )
          RETURNING
            id,
            procurement_id AS "procurementId",
            name,
            category,
            quantity,
            unit_price AS "unitPrice",
            created_at AS "createdAt"
        `,
        [
          randomUUID(),
          procurement.id,
          item.name,
          item.category,
          item.quantity,
          item.unitPrice,
        ],
      );

      const createdItem = mapAssetProcurementItemRecord(itemResult.rows[0]);

      if (createdItem) {
        items.push(createdItem);
      }
    }

    return {
      procurement,
      items,
    };
  },
};
