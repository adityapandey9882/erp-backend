import type { CompanyStatus } from "../companies/companies.types.js";
import type { CompanyUserProfile } from "../users/users.types.js";

export const ASSET_STATUSES = [
  "available",
  "assigned",
  "returned",
  "damaged",
  "under-maintenance",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const ASSET_EVENT_TYPES = [
  "created",
  "assigned",
  "returned",
  "maintenance",
  "status-updated",
  "note-added",
] as const;
export const MANUAL_ASSET_EVENT_TYPES = [
  "maintenance",
  "note-added",
] as const;

export type AssetEventType = (typeof ASSET_EVENT_TYPES)[number];
export type ManualAssetEventType = (typeof MANUAL_ASSET_EVENT_TYPES)[number];

export type AssetRecord = {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  serialNumber: string | null;
  brandModel: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  conditionLabel: string;
  status: AssetStatus;
  assignedToUserId: string | null;
  assignedAt: string | null;
  returnedAt: string | null;
  expectedReturnDate: string | null;
  assignmentCondition: string | null;
  assignmentNotes: string | null;
  notes: string | null;
  procurementItemId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetAssigneeSummary = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "email" | "status" | "department" | "designation"
>;

export type AssetView = Omit<AssetRecord, "assignedToUserId"> & {
  assignedTo: AssetAssigneeSummary | null;
};

export type EmployeeSelfAssetView = Pick<
  AssetRecord,
  | "id"
  | "assetCode"
  | "name"
  | "category"
  | "serialNumber"
  | "brandModel"
  | "purchaseDate"
  | "warrantyExpiry"
  | "conditionLabel"
  | "status"
  | "assignedAt"
  | "returnedAt"
  | "expectedReturnDate"
  | "assignmentCondition"
  | "assignmentNotes"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

export type AssetEventRecord = {
  id: string;
  companyId: string;
  assetId: string;
  type: AssetEventType;
  notes: string | null;
  actorUserId: string | null;
  createdAt: string;
};

export type AssetEventActorSummary = Pick<
  CompanyUserProfile,
  "id" | "fullName" | "role"
>;

export type AssetEventView = Omit<
  AssetEventRecord,
  "companyId" | "assetId" | "actorUserId"
> & {
  actor: AssetEventActorSummary | null;
};

export type AssetsWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  summary: {
    totalAssets: number;
    availableAssets: number;
    assignedAssets: number;
    returnedAssets: number;
    damagedAssets: number;
    underRepairAssets: number;
    warrantyExpiringAssets: number;
    employeesWithAssignedAssets: number;
  };
  clearance: {
    activeEmployees: number;
    employeesHoldingAssets: number;
    assetsPendingReturn: number;
  };
  items: AssetView[];
  availableAssignees: AssetAssigneeSummary[];
};

export type EmployeeAssetsWorkspaceResponse = {
  company: {
    id: string;
    name: string;
    code: string;
    industry: string;
    status: CompanyStatus;
  };
  employee: AssetAssigneeSummary;
  summary: {
    totalAssignedAssets: number;
    categoriesInUse: number;
    latestAssignedAt: string | null;
  };
  items: EmployeeSelfAssetView[];
};

export type AssetEventsResponse = {
  asset: Pick<
    AssetView,
    | "id"
    | "assetCode"
    | "name"
    | "category"
    | "brandModel"
    | "purchaseDate"
    | "warrantyExpiry"
    | "conditionLabel"
    | "status"
    | "assignedAt"
    | "returnedAt"
    | "expectedReturnDate"
    | "assignmentCondition"
    | "assignmentNotes"
    | "notes"
  >;
  events: AssetEventView[];
};

export type AssetProcurementRecord = {
  id: string;
  companyId: string;
  vendorName: string;
  invoiceNumber: string | null;
  purchaseDate: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
};

export type AssetProcurementItemRecord = {
  id: string;
  procurementId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  createdAt: string;
};

export type AssetProcurementLinkedAssetRecord = {
  id: string;
  procurementItemId: string;
  assetCode: string;
  name: string;
  category: string;
  status: AssetStatus;
  createdAt: string;
};

export type AssetProcurementListItemView = Omit<AssetProcurementRecord, "companyId"> & {
  itemLineCount: number;
  itemQuantityTotal: number;
  createdAssetsCount: number;
  remainingAssetsCount: number;
};

export type AssetProcurementItemView = Omit<
  AssetProcurementItemRecord,
  "procurementId"
> & {
  linkedAssets: AssetProcurementLinkedAssetRecord[];
  createdAssetsCount: number;
  remainingAssetsCount: number;
};

export type AssetProcurementDetailView = Omit<AssetProcurementRecord, "companyId"> & {
  items: AssetProcurementItemView[];
  totals: {
    itemLineCount: number;
    itemQuantityTotal: number;
    createdAssetsCount: number;
    remainingAssetsCount: number;
  };
};

export type AssetProcurementListResponse = {
  summary: {
    totalProcurements: number;
    totalRecordedAmount: number;
    createdAssetsCount: number;
    remainingAssetsCount: number;
  };
  items: AssetProcurementListItemView[];
};

export type AssetProcurementDetailResponse = {
  procurement: AssetProcurementDetailView;
};

export type CreateAssetRequest = {
  assetCode: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  brandModel?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  conditionLabel?: string | null;
  status?: AssetStatus;
  notes?: string | null;
};

export type UpdateAssetRequest = {
  assetCode: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  brandModel?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  conditionLabel?: string | null;
  status: AssetStatus;
  notes?: string | null;
};

export type AssignAssetRequest = {
  userId: string;
  expectedReturnDate?: string | null;
  conditionAtAssignment?: string | null;
  notes?: string | null;
};

export type CreateAssetEventRequest = {
  type: ManualAssetEventType;
  notes: string;
};

export type UpdateAssetStatusRequest = {
  status: AssetStatus;
  notes?: string | null;
};

export type CreateAssetProcurementItemRequest = {
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
};

export type CreateAssetProcurementRequest = {
  vendorName: string;
  invoiceNumber?: string | null;
  purchaseDate: string;
  notes?: string | null;
  items: CreateAssetProcurementItemRequest[];
};

export type CreateAssetInput = Omit<CreateAssetRequest, "status"> & {
  companyId: string;
  status: AssetStatus;
  expectedReturnDate?: string | null;
  assignmentCondition?: string | null;
  assignmentNotes?: string | null;
  procurementItemId?: string | null;
};

export type UpdateAssetInput = Omit<UpdateAssetRequest, "assetCode" | "name" | "category"> & {
  assetCode: string;
  name: string;
  category: string;
};

export type CreateAssetProcurementInput = Omit<
  CreateAssetProcurementRequest,
  "items"
> & {
  companyId: string;
  totalAmount: number;
  items: CreateAssetProcurementItemRequest[];
};

export type AssetMutationResponse = {
  message: string;
  asset: AssetView;
};

export type AssetEventMutationResponse = {
  message: string;
  event: AssetEventView;
};

export type AssetProcurementMutationResponse = {
  message: string;
  procurement: AssetProcurementDetailView;
  warnings?: string[];
};

export type AssetProcurementCreateAssetsResponse = {
  message: string;
  procurement: AssetProcurementDetailView;
  createdAssets: AssetProcurementLinkedAssetRecord[];
  warnings?: string[];
};

export type AssetsServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type AssetsServiceFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type AssetsServiceResult<T> = AssetsServiceSuccess<T> | AssetsServiceFailure;

export function isAssetStatus(value: string): value is AssetStatus {
  return ASSET_STATUSES.includes(value as AssetStatus);
}

export function isAssetEventType(value: string): value is AssetEventType {
  return ASSET_EVENT_TYPES.includes(value as AssetEventType);
}

export function isManualAssetEventType(value: string): value is ManualAssetEventType {
  return MANUAL_ASSET_EVENT_TYPES.includes(value as ManualAssetEventType);
}
