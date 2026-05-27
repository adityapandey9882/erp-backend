import type { AuthenticatedUser } from "../auth/auth.types.js";
import { auditService } from "../audit/audit.service.js";
import { companiesService } from "../companies/companies.service.js";
import { withTransaction } from "../../database/index.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { usersRepository } from "../users/users.repository.js";
import { assetsRepository } from "./assets.repository.js";
import type {
  AssetAssigneeSummary,
  AssetEventActorSummary,
  AssetEventMutationResponse,
  AssetProcurementCreateAssetsResponse,
  AssetProcurementDetailResponse,
  AssetProcurementDetailView,
  AssetProcurementItemRecord,
  AssetProcurementItemView,
  AssetProcurementLinkedAssetRecord,
  AssetProcurementListItemView,
  AssetProcurementListResponse,
  AssetProcurementMutationResponse,
  AssetProcurementRecord,
  AssetEventsResponse,
  AssetEventType,
  AssetEventView,
  AssetMutationResponse,
  AssetRecord,
  AssetView,
  CreateAssetEventRequest,
  EmployeeAssetsWorkspaceResponse,
  EmployeeSelfAssetView,
  AssetsServiceResult,
  AssetsWorkspaceResponse,
  AssignAssetRequest,
  CreateAssetRequest,
  CreateAssetProcurementRequest,
  UpdateAssetStatusRequest,
  UpdateAssetRequest,
} from "./assets.types.js";

function ok<T>(data: T): AssetsServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

function fail<T>(
  status: 400 | 403 | 404 | 409,
  message: string,
): AssetsServiceResult<T> {
  return {
    ok: false,
    status,
    message,
  };
}
function toAssigneeSummary(
  profile: Awaited<ReturnType<typeof usersRepository.findCompanyUserProfileById>>,
): AssetAssigneeSummary | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    status: profile.status,
    department: profile.department,
    designation: profile.designation,
  };
}

function toAssetEventActorSummary(
  profile: Awaited<ReturnType<typeof usersRepository.findCompanyUserProfileById>>,
): AssetEventActorSummary | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    role: profile.role,
  };
}

function buildAssetEventNotes(
  type: AssetEventType,
  input: {
    asset?: Pick<AssetRecord, "assetCode" | "name" | "status">;
    assignee?: Pick<AssetAssigneeSummary, "fullName"> | null;
    previousStatus?: string | null;
    nextStatus?: string | null;
    expectedReturnDate?: string | null;
    conditionAtAssignment?: string | null;
    notes?: string | null;
  } = {},
) {
  if (type === "assigned") {
    const segments = [
      input.assignee ? `Assigned to ${input.assignee.fullName}.` : "Assigned to an employee.",
      input.expectedReturnDate
        ? `Expected return on ${input.expectedReturnDate}.`
        : null,
      input.conditionAtAssignment
        ? `Condition at assignment: ${input.conditionAtAssignment}.`
        : null,
      input.notes ?? null,
    ].filter((value): value is string => Boolean(value));

    return segments.join(" ");
  }

  if (type === "returned") {
    return "Returned to inventory.";
  }

  if (type === "status-updated") {
    if (input.previousStatus && input.nextStatus) {
      return `Status changed from ${input.previousStatus} to ${input.nextStatus}.`;
    }

    return "Asset status updated.";
  }

  if (type === "created") {
    return input.notes ?? null;
  }

  return input.notes ?? null;
}

function isWarrantyExpiringSoon(value: string | null) {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + 30);
  const expiryDate = new Date(`${value}T00:00:00.000Z`);

  return expiryDate >= today && expiryDate <= threshold;
}

function mapAssetView(
  record: AssetRecord,
  assigneeLookup: Map<string, AssetAssigneeSummary>,
): AssetView {
  return {
    id: record.id,
    assetCode: record.assetCode,
    name: record.name,
    category: record.category,
    serialNumber: record.serialNumber,
    brandModel: record.brandModel,
    purchaseDate: record.purchaseDate,
    warrantyExpiry: record.warrantyExpiry,
    conditionLabel: record.conditionLabel,
    status: record.status,
    assignedTo: record.assignedToUserId
      ? assigneeLookup.get(record.assignedToUserId) ?? null
      : null,
    assignedAt: record.assignedAt,
    returnedAt: record.returnedAt,
    expectedReturnDate: record.expectedReturnDate,
    assignmentCondition: record.assignmentCondition,
    assignmentNotes: record.assignmentNotes,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapEmployeeSelfAssetView(record: AssetRecord): EmployeeSelfAssetView {
  return {
    id: record.id,
    assetCode: record.assetCode,
    name: record.name,
    category: record.category,
    serialNumber: record.serialNumber,
    brandModel: record.brandModel,
    purchaseDate: record.purchaseDate,
    warrantyExpiry: record.warrantyExpiry,
    conditionLabel: record.conditionLabel,
    status: record.status,
    assignedAt: record.assignedAt,
    returnedAt: record.returnedAt,
    expectedReturnDate: record.expectedReturnDate,
    assignmentCondition: record.assignmentCondition,
    assignmentNotes: record.assignmentNotes,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapAssetEventView(
  event: Awaited<ReturnType<typeof assetsRepository.createAssetEvent>>,
  actorLookup: Map<string, AssetEventActorSummary>,
): AssetEventView | null {
  if (!event) {
    return null;
  }

  return {
    id: event.id,
    type: event.type,
    notes: event.notes,
    createdAt: event.createdAt,
    actor: event.actorUserId ? actorLookup.get(event.actorUserId) ?? null : null,
  };
}

async function buildWorkspace(
  companyId: string,
): Promise<AssetsServiceResult<AssetsWorkspaceResponse>> {
  const [company, assets, employees] = await Promise.all([
    companiesService.getCompanyView(companyId),
    assetsRepository.listCompanyAssets(companyId),
    usersRepository.listCompanyUserProfiles(companyId),
  ]);

  if (!company) {
    return fail(404, "Company not found.");
  }

  const employeeProfiles = employees.filter((employee) => employee.role === "employee");
  const assigneeLookup = new Map(
    employeeProfiles
      .map((employee) => {
        const summary = toAssigneeSummary(employee);

        return summary ? ([summary.id, summary] as const) : null;
      })
      .filter((entry): entry is readonly [string, AssetAssigneeSummary] => entry !== null),
  );
  const items = assets.map((asset) => mapAssetView(asset, assigneeLookup));
  const employeesHoldingAssets = new Set(
    items
      .filter((asset) => asset.assignedTo !== null)
      .map((asset) => asset.assignedTo?.id ?? ""),
  );
  const availableAssignees = employeeProfiles
    .filter((employee) => employee.status === "active")
    .map((employee) => toAssigneeSummary(employee))
    .filter((employee): employee is AssetAssigneeSummary => employee !== null)
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  return ok({
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      industry: company.industry,
      status: company.status,
    },
    summary: {
      totalAssets: items.length,
      availableAssets: items.filter((asset) => asset.status === "available").length,
      assignedAssets: items.filter((asset) => asset.status === "assigned").length,
      returnedAssets: items.filter((asset) => asset.status === "returned").length,
      damagedAssets: items.filter((asset) => asset.status === "damaged").length,
      underRepairAssets: items.filter((asset) => asset.status === "under-maintenance").length,
      warrantyExpiringAssets: items.filter((asset) =>
        isWarrantyExpiringSoon(asset.warrantyExpiry),
      ).length,
      employeesWithAssignedAssets: employeesHoldingAssets.size,
    },
    clearance: {
      activeEmployees: availableAssignees.length,
      employeesHoldingAssets: employeesHoldingAssets.size,
      assetsPendingReturn: items.filter((asset) => asset.status === "assigned").length,
    },
    items,
    availableAssignees,
  });
}

async function buildEmployeeWorkspace(
  companyId: string,
  userId: string,
): Promise<AssetsServiceResult<EmployeeAssetsWorkspaceResponse>> {
  const [company, employeeProfile, assets] = await Promise.all([
    companiesService.getCompanyView(companyId),
    usersRepository.findCompanyUserProfileById(companyId, userId),
    assetsRepository.listAssetsAssignedToUser(companyId, userId),
  ]);

  if (!company) {
    return fail(404, "Company not found.");
  }

  if (!employeeProfile || employeeProfile.role !== "employee") {
    return fail(404, "Employee self profile not found.");
  }

  const employee = toAssigneeSummary(employeeProfile);

  if (!employee) {
    return fail(404, "Employee self profile not found.");
  }

  const items = assets.map((asset) => mapEmployeeSelfAssetView(asset));
  const categoriesInUse = new Set(items.map((asset) => asset.category)).size;
  const latestAssignedAt =
    items.find((asset) => asset.assignedAt !== null)?.assignedAt ?? null;

  return ok({
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      industry: company.industry,
      status: company.status,
    },
    employee,
    summary: {
      totalAssignedAssets: items.length,
      categoriesInUse,
      latestAssignedAt,
    },
    items,
  });
}

async function buildAssetEventActorLookup(companyId: string) {
  const profiles = await usersRepository.listCompanyUserProfiles(companyId);

  return new Map(
    profiles
      .map((profile) => {
        const actor = toAssetEventActorSummary(profile);

        return actor ? ([actor.id, actor] as const) : null;
      })
      .filter((entry): entry is readonly [string, AssetEventActorSummary] => entry !== null),
  );
}

async function buildAssetEventsResponse(
  companyId: string,
  asset: AssetRecord,
  mode: "admin" | "employee",
): Promise<AssetEventsResponse> {
  const [events, actorLookup] = await Promise.all([
    assetsRepository.listAssetEvents(companyId, asset.id),
    buildAssetEventActorLookup(companyId),
  ]);

  return {
    asset: {
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      category: asset.category,
      brandModel: asset.brandModel,
      purchaseDate: asset.purchaseDate,
      warrantyExpiry: asset.warrantyExpiry,
      conditionLabel: asset.conditionLabel,
      status: asset.status,
      assignedAt: asset.assignedAt,
      returnedAt: asset.returnedAt,
      expectedReturnDate: asset.expectedReturnDate,
      assignmentCondition: asset.assignmentCondition,
      assignmentNotes: asset.assignmentNotes,
      notes: asset.notes,
    },
    events: events
      .map((event) => mapAssetEventView(event, actorLookup))
      .filter((event): event is AssetEventView => event !== null)
      .map((event) =>
        mode === "employee" &&
        (event.type === "maintenance" || event.type === "note-added")
          ? {
              ...event,
              notes: null,
            }
          : event,
      ),
  };
}

async function createAssetEventResponse(
  actor: Pick<AuthenticatedUser, "id" | "fullName" | "role">,
  input: {
    companyId: string;
    assetId: string;
    type: AssetEventType;
    notes?: string | null;
  },
): Promise<AssetEventMutationResponse | null> {
  const createdEvent = await assetsRepository.createAssetEvent({
    companyId: input.companyId,
    assetId: input.assetId,
    type: input.type,
    notes: input.notes ?? null,
    actorUserId: actor.id,
  });

  const event = mapAssetEventView(
    createdEvent,
    new Map([
      [
        actor.id,
        {
          id: actor.id,
          fullName: actor.fullName,
          role: actor.role,
        },
      ],
    ]),
  );

  if (!event) {
    return null;
  }

  return {
    message: "Asset lifecycle event created successfully.",
    event,
  };
}

async function ensureUniqueAssetCode(
  companyId: string,
  assetCode: string,
  excludeAssetId?: string,
) {
  const existingAsset = await assetsRepository.findCompanyAssetByCode(
    companyId,
    assetCode,
  );

  return !existingAsset || existingAsset.id === excludeAssetId;
}

async function ensureUniqueSerialNumber(
  companyId: string,
  serialNumber: string | null | undefined,
  excludeAssetId?: string,
) {
  if (!serialNumber) {
    return true;
  }

  const existingAsset = await assetsRepository.findCompanyAssetBySerialNumber(
    companyId,
    serialNumber,
  );

  return !existingAsset || existingAsset.id === excludeAssetId;
}

async function buildMutationResponse(
  companyId: string,
  record: AssetRecord | null,
  message: string,
): Promise<AssetsServiceResult<AssetMutationResponse>> {
  if (!record) {
    return fail(404, "Asset record not found.");
  }

  const assigneeLookup = new Map<string, AssetAssigneeSummary>();

  if (record.assignedToUserId) {
    const assignee = await usersRepository.findCompanyUserProfileById(
      companyId,
      record.assignedToUserId,
    );
    const summary = toAssigneeSummary(assignee);

    if (summary) {
      assigneeLookup.set(summary.id, summary);
    }
  }

  return ok({
    message,
    asset: mapAssetView(record, assigneeLookup),
  });
}

function canManageProcurement(user: Pick<AuthenticatedUser, "role">) {
  return user.role === "admin" || user.role === "hr";
}

function buildProcurementGenerationLabel(createdAssetsCount: number, totalQuantity: number) {
  return `${createdAssetsCount} of ${totalQuantity} assets generated`;
}

function sanitizeAssetCodeSegment(value: string, fallback: string) {
  const normalized = value.replace(/[^a-z0-9]/gi, "").toUpperCase();

  return normalized.length > 0 ? normalized.slice(0, 4) : fallback;
}

function buildProcuredAssetCode(
  item: Pick<AssetProcurementItemRecord, "id" | "category">,
  ordinal: number,
) {
  const prefix = sanitizeAssetCodeSegment(item.category, "AST");
  const itemSegment = item.id.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);

  return `${prefix}-${itemSegment}-${String(ordinal).padStart(3, "0")}`;
}

function buildProcurementCreatedEventNotes(
  procurement: Pick<AssetProcurementRecord, "id" | "invoiceNumber" | "vendorName">,
) {
  const sourceLabel = procurement.invoiceNumber
    ? `invoice ${procurement.invoiceNumber}`
    : `procurement ${procurement.id.slice(0, 8)}`;

  return `Generated from ${sourceLabel} (${procurement.vendorName}).`;
}

function buildProcurementItemView(
  item: AssetProcurementItemRecord,
  linkedAssets: AssetProcurementLinkedAssetRecord[],
): AssetProcurementItemView {
  const assetsForItem = linkedAssets.filter(
    (linkedAsset) => linkedAsset.procurementItemId === item.id,
  );
  const createdAssetsCount = assetsForItem.length;

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    createdAt: item.createdAt,
    linkedAssets: assetsForItem,
    createdAssetsCount,
    remainingAssetsCount: Math.max(item.quantity - createdAssetsCount, 0),
  };
}

function buildProcurementDetailView(
  procurement: AssetProcurementRecord,
  items: AssetProcurementItemRecord[],
  linkedAssets: AssetProcurementLinkedAssetRecord[],
): AssetProcurementDetailView {
  const procurementItems = items
    .filter((item) => item.procurementId === procurement.id)
    .map((item) => buildProcurementItemView(item, linkedAssets));
  const itemQuantityTotal = procurementItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const createdAssetsCount = procurementItems.reduce(
    (total, item) => total + item.createdAssetsCount,
    0,
  );

  return {
    id: procurement.id,
    vendorName: procurement.vendorName,
    invoiceNumber: procurement.invoiceNumber,
    purchaseDate: procurement.purchaseDate,
    totalAmount: procurement.totalAmount,
    notes: procurement.notes,
    createdAt: procurement.createdAt,
    items: procurementItems,
    totals: {
      itemLineCount: procurementItems.length,
      itemQuantityTotal,
      createdAssetsCount,
      remainingAssetsCount: Math.max(itemQuantityTotal - createdAssetsCount, 0),
    },
  };
}

async function buildProcurementDetailResponse(
  companyId: string,
  procurementId: string,
): Promise<AssetProcurementDetailResponse | null> {
  const [procurement, items, linkedAssets] = await Promise.all([
    assetsRepository.findCompanyProcurementById(companyId, procurementId),
    assetsRepository.listProcurementItems(companyId, procurementId),
    assetsRepository.listProcurementLinkedAssets(companyId, procurementId),
  ]);

  if (!procurement) {
    return null;
  }

  return {
    procurement: buildProcurementDetailView(procurement, items, linkedAssets),
  };
}

async function buildProcurementList(
  companyId: string,
): Promise<AssetProcurementListResponse> {
  const procurements = await assetsRepository.listCompanyProcurementSummaries(companyId);
  const procurementItems = procurements.map((procurement) => ({
    id: procurement.id,
    vendorName: procurement.vendorName,
    invoiceNumber: procurement.invoiceNumber,
    purchaseDate: procurement.purchaseDate,
    totalAmount: procurement.totalAmount,
    notes: procurement.notes,
    createdAt: procurement.createdAt,
    itemLineCount: procurement.itemLineCount,
    itemQuantityTotal: procurement.itemQuantityTotal,
    createdAssetsCount: procurement.createdAssetsCount,
    remainingAssetsCount: Math.max(
      procurement.itemQuantityTotal - procurement.createdAssetsCount,
      0,
    ),
  }) satisfies AssetProcurementListItemView);

  return {
    summary: {
      totalProcurements: procurementItems.length,
      totalRecordedAmount: procurementItems.reduce(
        (total, procurement) => total + procurement.totalAmount,
        0,
      ),
      createdAssetsCount: procurementItems.reduce(
        (total, procurement) => total + procurement.createdAssetsCount,
        0,
      ),
      remainingAssetsCount: procurementItems.reduce(
        (total, procurement) => total + procurement.remainingAssetsCount,
        0,
      ),
    },
    items: procurementItems,
  };
}

export const assetsService = {
  async getWorkspace(
    user: AuthenticatedUser,
  ): Promise<AssetsServiceResult<AssetsWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    return buildWorkspace(user.companyId);
  },

  async listProcurements(
    user: AuthenticatedUser,
  ): Promise<AssetsServiceResult<AssetProcurementListResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!canManageProcurement(user)) {
      return fail(403, "Only Admin and HR users can access asset procurement.");
    }

    return ok(await buildProcurementList(user.companyId));
  },

  async getProcurement(
    user: AuthenticatedUser,
    procurementId: string,
  ): Promise<AssetsServiceResult<AssetProcurementDetailResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!canManageProcurement(user)) {
      return fail(403, "Only Admin and HR users can access asset procurement.");
    }

    const detail = await buildProcurementDetailResponse(user.companyId, procurementId);

    if (!detail) {
      return fail(404, "Procurement record not found.");
    }

    return ok(detail);
  },

  async createProcurement(
    user: AuthenticatedUser,
    input: CreateAssetProcurementRequest,
  ): Promise<AssetsServiceResult<AssetProcurementMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!canManageProcurement(user)) {
      return fail(403, "Only Admin and HR users can create procurements.");
    }

    const warnings: string[] = [];
    if (input.invoiceNumber) {
      const existingInvoiceMatch =
        await assetsRepository.findCompanyProcurementByInvoiceNumber(
          user.companyId,
          input.invoiceNumber,
        );

      if (existingInvoiceMatch) {
        warnings.push(
          `Invoice number ${input.invoiceNumber} already exists in this company. The procurement was saved, but the invoice should be reviewed for duplication.`,
        );
      }
    }

    const totalAmount = input.items.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0,
    );

    const created = await withTransaction(async (client) =>
      assetsRepository.createProcurement(
        {
          companyId: user.companyId as string,
          vendorName: input.vendorName,
          invoiceNumber: input.invoiceNumber ?? null,
          purchaseDate: input.purchaseDate,
          notes: input.notes ?? null,
          totalAmount: Number(totalAmount.toFixed(2)),
          items: input.items,
        },
        client,
      ),
    );

    if (!created) {
      return fail(404, "Procurement record could not be created.");
    }

    const detail = await buildProcurementDetailResponse(user.companyId, created.procurement.id);

    if (!detail) {
      return fail(404, "Procurement record not found.");
    }

    void auditService.recordAction(user, {
      action: "procurement_created",
      entityType: "asset-procurement",
      entityId: created.procurement.id,
      metadata: {
        procurementId: created.procurement.id,
        vendorName: created.procurement.vendorName,
        invoiceNumber: created.procurement.invoiceNumber,
        totalAmount: created.procurement.totalAmount,
        itemLineCount: detail.procurement.totals.itemLineCount,
        itemQuantityTotal: detail.procurement.totals.itemQuantityTotal,
        itemIds: created.items.map((item) => item.id),
      },
    });

    return ok({
      message: "Procurement record created successfully.",
      procurement: detail.procurement,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  },

  async createAssetsFromProcurement(
    user: AuthenticatedUser,
    procurementId: string,
  ): Promise<AssetsServiceResult<AssetProcurementCreateAssetsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    if (!canManageProcurement(user)) {
      return fail(403, "Only Admin and HR users can generate assets from procurement.");
    }

    const createdAssets = await withTransaction(async (client) => {
      const lockedProcurement = await assetsRepository.lockCompanyProcurementForUpdate(
        user.companyId as string,
        procurementId,
        client,
      );

      if (!lockedProcurement) {
        return null;
      }

      const [items, linkedAssets] = await Promise.all([
        assetsRepository.listProcurementItems(user.companyId as string, procurementId, client),
        assetsRepository.listProcurementLinkedAssets(
          user.companyId as string,
          procurementId,
          client,
        ),
      ]);
      const generatedAssets: AssetProcurementLinkedAssetRecord[] = [];

      for (const item of items) {
        const existingAssets = linkedAssets.filter(
          (linkedAsset) => linkedAsset.procurementItemId === item.id,
        );
        const remainingAssetsToCreate = Math.max(
          item.quantity - existingAssets.length,
          0,
        );

        for (let index = 0; index < remainingAssetsToCreate; index += 1) {
          const ordinal = existingAssets.length + index + 1;
          const asset = await assetsRepository.createAsset(
            {
              companyId: user.companyId as string,
              assetCode: buildProcuredAssetCode(item, ordinal),
              name:
                item.quantity > 1
                  ? `${item.name} ${ordinal}`
                  : item.name,
              category: item.category,
              serialNumber: null,
              brandModel: null,
              purchaseDate: lockedProcurement.purchaseDate,
              warrantyExpiry: null,
              conditionLabel: "Good",
              status: "available",
              expectedReturnDate: null,
              assignmentCondition: null,
              assignmentNotes: null,
              notes: null,
              procurementItemId: item.id,
            },
            client,
          );

          if (!asset) {
            continue;
          }

          await assetsRepository.createAssetEvent(
            {
              companyId: user.companyId as string,
              assetId: asset.id,
              type: "created",
              actorUserId: user.id,
              notes: buildProcurementCreatedEventNotes(lockedProcurement),
            },
            client,
          );

          generatedAssets.push({
            id: asset.id,
            procurementItemId: item.id,
            assetCode: asset.assetCode,
            name: asset.name,
            category: asset.category,
            status: asset.status,
            createdAt: asset.createdAt,
          });
        }
      }

      return {
        procurement: lockedProcurement,
        items,
        generatedAssets,
      };
    });

    if (!createdAssets) {
      return fail(404, "Procurement record not found.");
    }

    if (createdAssets.generatedAssets.length === 0) {
      return fail(
        409,
        "All procurement items have already been converted into assets.",
      );
    }

    const detail = await buildProcurementDetailResponse(user.companyId, procurementId);

    if (!detail) {
      return fail(404, "Procurement record not found.");
    }

    void auditService.recordAction(user, {
      action: "procurement_assets_generated",
      entityType: "asset-procurement",
      entityId: procurementId,
      metadata: {
        procurementId,
        createdAssetsCount: createdAssets.generatedAssets.length,
        itemLineCount: detail.procurement.totals.itemLineCount,
        itemIds: createdAssets.items.map((item) => item.id),
        assetIds: createdAssets.generatedAssets.map((asset) => asset.id),
        createdAssetCodes: createdAssets.generatedAssets.map((asset) => asset.assetCode),
        generatedEntries: createdAssets.generatedAssets.map((asset) => ({
          itemId: asset.procurementItemId,
          assetId: asset.id,
        })),
      },
    });

    return ok({
      message:
        createdAssets.generatedAssets.length === 1
          ? "1 asset created from procurement."
          : `${createdAssets.generatedAssets.length} assets created from procurement.`,
      procurement: detail.procurement,
      createdAssets: createdAssets.generatedAssets,
    });
  },

  async getEmployeeWorkspace(
    user: AuthenticatedUser,
  ): Promise<AssetsServiceResult<EmployeeAssetsWorkspaceResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    return buildEmployeeWorkspace(user.companyId, user.id);
  },

  async getAssetEvents(
    user: AuthenticatedUser,
    assetId: string,
  ): Promise<AssetsServiceResult<AssetEventsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const asset = await assetsRepository.findCompanyAssetById(user.companyId, assetId);

    if (!asset) {
      return fail(404, "Asset not found.");
    }

    return ok(await buildAssetEventsResponse(user.companyId, asset, "admin"));
  },

  async getEmployeeAssetEvents(
    user: AuthenticatedUser,
    assetId: string,
  ): Promise<AssetsServiceResult<AssetEventsResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const asset = await assetsRepository.findCompanyAssetById(user.companyId, assetId);

    if (!asset || asset.assignedToUserId !== user.id) {
      return fail(404, "Asset not found.");
    }

    return ok(await buildAssetEventsResponse(user.companyId, asset, "employee"));
  },

  async createAsset(
    user: AuthenticatedUser,
    input: CreateAssetRequest,
  ): Promise<AssetsServiceResult<AssetMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const status = input.status ?? "available";

    if (status === "assigned" || status === "returned") {
      return fail(
        409,
        "Use assign or return actions to manage assigned and returned asset states.",
      );
    }

    if (!(await ensureUniqueAssetCode(user.companyId, input.assetCode))) {
      return fail(409, "An asset with this code already exists for the company.");
    }

    if (!(await ensureUniqueSerialNumber(user.companyId, input.serialNumber))) {
      return fail(
        409,
        "An asset with this serial number already exists for the company.",
      );
    }

    const asset = await assetsRepository.createAsset({
      companyId: user.companyId,
      assetCode: input.assetCode,
      name: input.name,
      category: input.category,
      serialNumber: input.serialNumber ?? null,
      brandModel: input.brandModel ?? null,
      purchaseDate: input.purchaseDate ?? null,
      warrantyExpiry: input.warrantyExpiry ?? null,
      conditionLabel: input.conditionLabel ?? "Good",
      status,
      expectedReturnDate: null,
      assignmentCondition: null,
      assignmentNotes: null,
      notes: input.notes ?? null,
    });

    if (asset) {
      await assetsRepository.createAssetEvent({
        companyId: user.companyId,
        assetId: asset.id,
        type: "created",
        actorUserId: user.id,
        notes: buildAssetEventNotes("created"),
      });

      if (input.notes?.trim()) {
        await assetsRepository.createAssetEvent({
          companyId: user.companyId,
          assetId: asset.id,
          type: "note-added",
          actorUserId: user.id,
          notes: input.notes.trim(),
        });
      }
    }

    return buildMutationResponse(user.companyId, asset, "Asset created successfully.");
  },

  async updateAsset(
    user: AuthenticatedUser,
    assetId: string,
    input: UpdateAssetRequest,
  ): Promise<AssetsServiceResult<AssetMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingAsset = await assetsRepository.findCompanyAssetById(
      user.companyId,
      assetId,
    );

    if (!existingAsset) {
      return fail(404, "Asset not found.");
    }

    if (!(await ensureUniqueAssetCode(user.companyId, input.assetCode, assetId))) {
      return fail(409, "An asset with this code already exists for the company.");
    }

    if (
      !(await ensureUniqueSerialNumber(
        user.companyId,
        input.serialNumber,
        assetId,
      ))
    ) {
      return fail(
        409,
        "An asset with this serial number already exists for the company.",
      );
    }

    if (existingAsset.assignedToUserId) {
      if (input.status !== existingAsset.status) {
        return fail(
          409,
          "Use the return flow before changing the status of an assigned asset.",
        );
      }
    } else if (
      input.status === "assigned" ||
      (input.status === "returned" && existingAsset.status !== "returned")
    ) {
      return fail(
        409,
        "Use assign or return actions to manage assigned and returned asset states.",
      );
    }

    const asset = await assetsRepository.updateAsset(user.companyId, assetId, {
      assetCode: input.assetCode,
      name: input.name,
      category: input.category,
      serialNumber: input.serialNumber ?? null,
      brandModel: input.brandModel ?? null,
      purchaseDate: input.purchaseDate ?? null,
      warrantyExpiry: input.warrantyExpiry ?? null,
      conditionLabel: input.conditionLabel ?? existingAsset.conditionLabel,
      status: input.status,
      notes: input.notes ?? null,
    });

    if (asset && existingAsset.status !== asset.status) {
      await assetsRepository.createAssetEvent({
        companyId: user.companyId,
        assetId: asset.id,
        type: "status-updated",
        actorUserId: user.id,
        notes: buildAssetEventNotes("status-updated", {
          previousStatus: existingAsset.status,
          nextStatus: asset.status,
        }),
      });
    }

    if (
      asset &&
      input.notes !== existingAsset.notes &&
      input.notes &&
      input.notes.trim().length > 0
    ) {
      await assetsRepository.createAssetEvent({
        companyId: user.companyId,
        assetId: asset.id,
        type: "note-added",
        actorUserId: user.id,
        notes: input.notes.trim(),
      });
    }

    return buildMutationResponse(user.companyId, asset, "Asset updated successfully.");
  },

  async assignAsset(
    user: AuthenticatedUser,
    assetId: string,
    input: AssignAssetRequest,
  ): Promise<AssetsServiceResult<AssetMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const [asset, assignee] = await Promise.all([
      assetsRepository.findCompanyAssetById(user.companyId, assetId),
      usersRepository.findCompanyUserProfileById(user.companyId, input.userId),
    ]);

    if (!asset) {
      return fail(404, "Asset not found.");
    }

    if (!assignee || assignee.role !== "employee") {
      return fail(404, "Employee assignee not found for this company.");
    }

    if (assignee.status !== "active") {
      return fail(409, "Only active employees can receive asset assignments.");
    }

    if (asset.assignedToUserId) {
      return fail(409, "This asset is already assigned.");
    }

    if (asset.status === "damaged") {
      return fail(409, "Damaged assets cannot be assigned.");
    }

    if (asset.status === "under-maintenance") {
      return fail(409, "Assets under maintenance cannot be assigned.");
    }

    const updatedAsset = await assetsRepository.assignAsset(
      user.companyId,
      assetId,
      {
        userId: input.userId,
        expectedReturnDate: input.expectedReturnDate ?? null,
        conditionAtAssignment: input.conditionAtAssignment ?? null,
        notes: input.notes ?? null,
      },
    );

    if (updatedAsset) {
      await assetsRepository.createAssetEvent({
        companyId: user.companyId,
        assetId: updatedAsset.id,
        type: "assigned",
        actorUserId: user.id,
        notes: buildAssetEventNotes("assigned", {
          assignee: {
            fullName: assignee.fullName,
          },
          expectedReturnDate: input.expectedReturnDate ?? null,
          conditionAtAssignment: input.conditionAtAssignment ?? null,
          notes: input.notes ?? null,
        }),
      });

      void notificationsService.notifyUser(user.companyId, input.userId, {
        type: "asset.assigned",
        title: "Asset assigned",
        message: `${updatedAsset.name} (${updatedAsset.assetCode}) has been assigned to you.`,
        entityType: "asset",
        entityId: updatedAsset.id,
      });

      void auditService.recordAction(user, {
        action: "asset.assigned",
        entityType: "asset",
        entityId: updatedAsset.id,
        metadata: {
          asset: {
            id: updatedAsset.id,
            assetCode: updatedAsset.assetCode,
            name: updatedAsset.name,
          },
          assigneeId: input.userId,
        },
      });
    }

    return buildMutationResponse(
      user.companyId,
      updatedAsset,
      "Asset assigned successfully.",
    );
  },

  async returnAsset(
    user: AuthenticatedUser,
    assetId: string,
  ): Promise<AssetsServiceResult<AssetMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const asset = await assetsRepository.findCompanyAssetById(
      user.companyId,
      assetId,
    );

    if (!asset) {
      return fail(404, "Asset not found.");
    }

    if (!asset.assignedToUserId || asset.status !== "assigned") {
      return fail(409, "Only currently assigned assets can be returned.");
    }

    const updatedAsset = await assetsRepository.returnAsset(user.companyId, assetId);

    if (updatedAsset) {
      await assetsRepository.createAssetEvent({
        companyId: user.companyId,
        assetId: updatedAsset.id,
        type: "returned",
        actorUserId: user.id,
        notes: buildAssetEventNotes("returned"),
      });

      void auditService.recordAction(user, {
        action: "asset.returned",
        entityType: "asset",
        entityId: updatedAsset.id,
        metadata: {
          asset: {
            id: updatedAsset.id,
            assetCode: updatedAsset.assetCode,
            name: updatedAsset.name,
          },
        },
      });
    }

    return buildMutationResponse(
      user.companyId,
      updatedAsset,
      "Asset returned successfully.",
    );
  },

  async createAssetEvent(
    user: AuthenticatedUser,
    assetId: string,
    input: CreateAssetEventRequest,
  ): Promise<AssetsServiceResult<AssetEventMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const asset = await assetsRepository.findCompanyAssetById(user.companyId, assetId);

    if (!asset) {
      return fail(404, "Asset not found.");
    }

    const response = await createAssetEventResponse(user, {
      companyId: user.companyId,
      assetId,
      type: input.type,
      notes: input.notes,
    });

    if (!response) {
      return fail(404, "Asset not found.");
    }

    void auditService.recordAction(user, {
      action: "asset.lifecycle.event.created",
      entityType: "asset",
      entityId: asset.id,
      metadata: {
        asset: {
          id: asset.id,
          assetCode: asset.assetCode,
          name: asset.name,
        },
        eventType: input.type,
        notesRecorded: input.notes.trim().length > 0,
      },
    });

    return ok(response);
  },

  async updateAssetStatus(
    user: AuthenticatedUser,
    assetId: string,
    input: UpdateAssetStatusRequest,
  ): Promise<AssetsServiceResult<AssetMutationResponse>> {
    if (!user.companyId) {
      return fail(403, "Your account is not assigned to a company context.");
    }

    const existingAsset = await assetsRepository.findCompanyAssetById(
      user.companyId,
      assetId,
    );

    if (!existingAsset) {
      return fail(404, "Asset not found.");
    }

    if (existingAsset.assignedToUserId || existingAsset.status === "assigned") {
      return fail(
        409,
        "Use the return flow before changing the status of an assigned asset.",
      );
    }

    if (input.status === "assigned" || input.status === "returned") {
      return fail(
        409,
        "Use assign or return actions to manage assigned and returned asset states.",
      );
    }

    const notesChanged =
      input.notes !== undefined && input.notes !== existingAsset.notes;

    if (input.status === existingAsset.status && !notesChanged) {
      return fail(409, "No status or note change was provided.");
    }

    const updatedAsset = await assetsRepository.updateAssetStatus(
      user.companyId,
      assetId,
      {
        status: input.status,
        notes: input.notes,
      },
    );

    if (!updatedAsset) {
      return fail(404, "Asset not found.");
    }

    if (updatedAsset.status !== existingAsset.status) {
      await assetsRepository.createAssetEvent({
        companyId: user.companyId,
        assetId: updatedAsset.id,
        type: "status-updated",
        actorUserId: user.id,
        notes: buildAssetEventNotes("status-updated", {
          previousStatus: existingAsset.status,
          nextStatus: updatedAsset.status,
          notes: input.notes ?? null,
        }),
      });
    }

    if (
      notesChanged &&
      input.notes &&
      input.notes.trim().length > 0
    ) {
      await assetsRepository.createAssetEvent({
        companyId: user.companyId,
        assetId: updatedAsset.id,
        type: "note-added",
        actorUserId: user.id,
        notes: input.notes.trim(),
      });
    }

    void auditService.recordAction(user, {
      action: "asset.status.updated",
      entityType: "asset",
      entityId: updatedAsset.id,
      metadata: {
        asset: {
          id: updatedAsset.id,
          assetCode: updatedAsset.assetCode,
          name: updatedAsset.name,
        },
        previousStatus: existingAsset.status,
        nextStatus: updatedAsset.status,
        notesChanged,
      },
    });

    return buildMutationResponse(
      user.companyId,
      updatedAsset,
      "Asset status updated successfully.",
    );
  },
};
