import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "./service-helpers";
import { mapOperationalError } from "./service-helpers";
import {
  contractSchema, customerAddressSchema, customerContactSchema, customerSchema, listQuerySchema,
  normalizeDocument, resourceCategorySchema, resourceSchema, unitSchema,
} from "./validation";

function audit(context: OperationalContext, action: string, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
  return { scope: "TENANT" as const, tenantId: context.tenantId, actorUserId: context.user.id, action, entityType, entityId, metadata };
}

function notFound() { return new AppError("NOT_FOUND", "Registro não encontrado."); }

export async function listUnits(context: OperationalContext, raw: unknown = {}) {
  requirePermission(context.permissions, "units.view");
  const query = listQuerySchema.parse(raw);
  const where: Prisma.UnitWhereInput = { tenantId: context.tenantId, ...(query.status ? { status: query.status as Prisma.EnumRecordStatusFilter } : {}), ...(query.search ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { code: { contains: query.search, mode: "insensitive" } }] } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.unit.findMany({ where, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.unit.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function createUnit(context: OperationalContext, raw: unknown) {
  requirePermission(context.permissions, "units.create");
  const input = unitSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({ data: { tenantId: context.tenantId, name: input.name, code: input.code, status: input.status, phone: input.phone, email: input.email, addressLine1: input.addressLine1, addressLine2: input.addressLine2, city: input.city, state: input.state, postalCode: input.postalCode, country: input.country } });
      await tx.auditLog.create({ data: audit(context, "unit.created", "Unit", unit.id) });
      return unit;
    });
  } catch (error) { mapOperationalError(error); }
}

export async function updateUnit(context: OperationalContext, id: string, raw: unknown) {
  requirePermission(context.permissions, "units.update");
  const input = unitSchema.parse(raw);
  if (input.status !== "ACTIVE") requirePermission(context.permissions, "units.disable");
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.unit.updateMany({ where: { id, tenantId: context.tenantId }, data: { name: input.name, code: input.code, status: input.status, phone: input.phone, email: input.email, addressLine1: input.addressLine1, addressLine2: input.addressLine2, city: input.city, state: input.state, postalCode: input.postalCode, country: input.country } });
      if (!result.count) throw notFound();
      await tx.auditLog.create({ data: audit(context, input.status === "ACTIVE" ? "unit.updated" : "unit.disabled", "Unit", id, { status: input.status }) });
      return tx.unit.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    });
  } catch (error) { mapOperationalError(error); }
}

export async function listCustomers(context: OperationalContext, raw: unknown = {}) {
  requirePermission(context.permissions, "customers.view");
  const query = listQuerySchema.parse(raw);
  const where: Prisma.CustomerWhereInput = { tenantId: context.tenantId, ...(query.status ? { status: query.status as Prisma.EnumRecordStatusFilter } : {}), ...(query.search ? { OR: [{ legalName: { contains: query.search, mode: "insensitive" } }, { tradeName: { contains: query.search, mode: "insensitive" } }, { normalizedDocument: { contains: normalizeDocument(query.search) } }] } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({ where, include: { contacts: { where: { status: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }, addresses: { where: { status: "ACTIVE" }, orderBy: { isPrimary: "desc" } }, _count: { select: { contracts: true } } }, orderBy: { legalName: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getCustomer(context: OperationalContext, id: string) {
  requirePermission(context.permissions, "customers.view");
  const customer = await prisma.customer.findFirst({ where: { id, tenantId: context.tenantId }, include: { contacts: true, addresses: true, contracts: { orderBy: { startDate: "desc" } } } });
  if (!customer) throw notFound();
  return customer;
}

export async function createCustomer(context: OperationalContext, raw: unknown) {
  requirePermission(context.permissions, "customers.create");
  const input = customerSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: { tenantId: context.tenantId, type: input.type, legalName: input.legalName, tradeName: input.tradeName, document: input.document, normalizedDocument: normalizeDocument(input.document), status: input.status, email: input.email, phone: input.phone, notes: input.notes } });
      if (input.primaryContact) await tx.customerContact.create({ data: { tenantId: context.tenantId, customerId: customer.id, name: input.primaryContact.name, title: input.primaryContact.title, email: input.primaryContact.email, phone: input.primaryContact.phone, whatsapp: input.primaryContact.whatsapp, isPrimary: true, status: input.primaryContact.status } });
      if (input.primaryAddress) await tx.customerAddress.create({ data: { tenantId: context.tenantId, customerId: customer.id, type: input.primaryAddress.type, label: input.primaryAddress.label, addressLine1: input.primaryAddress.addressLine1, addressLine2: input.primaryAddress.addressLine2, city: input.primaryAddress.city, state: input.primaryAddress.state, postalCode: input.primaryAddress.postalCode, country: input.primaryAddress.country, isPrimary: true, status: input.primaryAddress.status } });
      await tx.auditLog.create({ data: audit(context, "customer.created", "Customer", customer.id) });
      return customer;
    });
  } catch (error) { mapOperationalError(error); }
}

export async function updateCustomer(context: OperationalContext, id: string, raw: unknown) {
  requirePermission(context.permissions, "customers.update");
  const input = customerSchema.parse(raw);
  if (input.status !== "ACTIVE") requirePermission(context.permissions, "customers.disable");
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({ where: { id, tenantId: context.tenantId }, data: { type: input.type, legalName: input.legalName, tradeName: input.tradeName, document: input.document, normalizedDocument: normalizeDocument(input.document), status: input.status, email: input.email, phone: input.phone, notes: input.notes } });
      if (!result.count) throw notFound();
      await tx.auditLog.create({ data: audit(context, input.status === "ACTIVE" ? "customer.updated" : "customer.disabled", "Customer", id, { status: input.status }) });
      return tx.customer.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    });
  } catch (error) { mapOperationalError(error); }
}

export async function addCustomerContact(context: OperationalContext, customerId: string, raw: unknown) {
  requirePermission(context.permissions, "customers.update");
  const input = customerContactSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId: context.tenantId }, select: { id: true } });
      if (!customer) throw notFound();
      if (input.isPrimary) await tx.customerContact.updateMany({ where: { tenantId: context.tenantId, customerId }, data: { isPrimary: false } });
      const contact = await tx.customerContact.create({ data: { tenantId: context.tenantId, customerId, name: input.name, title: input.title, email: input.email, phone: input.phone, whatsapp: input.whatsapp, isPrimary: input.isPrimary, status: input.status } });
      await tx.auditLog.create({ data: audit(context, "customer.contact.created", "CustomerContact", contact.id, { customerId }) });
      return contact;
    });
  } catch (error) { mapOperationalError(error); }
}

export async function addCustomerAddress(context: OperationalContext, customerId: string, raw: unknown) {
  requirePermission(context.permissions, "customers.update");
  const input = customerAddressSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId: context.tenantId }, select: { id: true } });
      if (!customer) throw notFound();
      if (input.isPrimary) await tx.customerAddress.updateMany({ where: { tenantId: context.tenantId, customerId }, data: { isPrimary: false } });
      const address = await tx.customerAddress.create({ data: { tenantId: context.tenantId, customerId, type: input.type, label: input.label, addressLine1: input.addressLine1, addressLine2: input.addressLine2, city: input.city, state: input.state, postalCode: input.postalCode, country: input.country, isPrimary: input.isPrimary, status: input.status } });
      await tx.auditLog.create({ data: audit(context, "customer.address.created", "CustomerAddress", address.id, { customerId }) });
      return address;
    });
  } catch (error) { mapOperationalError(error); }
}

export async function listContracts(context: OperationalContext, raw: unknown = {}) {
  requirePermission(context.permissions, "contracts.view");
  const query = listQuerySchema.parse(raw);
  const where: Prisma.ContractWhereInput = { tenantId: context.tenantId, ...(query.status ? { status: query.status as Prisma.EnumContractStatusFilter } : {}), ...(query.search ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { code: { contains: query.search, mode: "insensitive" } }, { customer: { legalName: { contains: query.search, mode: "insensitive" } } }] } : {}) };
  const [items, total] = await prisma.$transaction([prisma.contract.findMany({ where, include: { customer: { select: { legalName: true } }, units: { include: { unit: { select: { name: true } } } } }, orderBy: { startDate: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.contract.count({ where })]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getContractFormOptions(context: OperationalContext) {
  if (!context.permissions.has("contracts.create") && !context.permissions.has("contracts.update")) throw new AppError("FORBIDDEN", "Você não possui permissão para esta ação.");
  const [customers, units] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true, legalName: true }, orderBy: { legalName: "asc" }, take: 200 }),
    prisma.unit.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
  ]);
  return { customers, units };
}

export async function createContract(context: OperationalContext, raw: unknown) {
  requirePermission(context.permissions, "contracts.create");
  const input = contractSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true } });
      if (!customer) throw notFound();
      if (input.unitIds.length) {
        const units = await tx.unit.count({ where: { id: { in: input.unitIds }, tenantId: context.tenantId, status: "ACTIVE" } });
        if (units !== new Set(input.unitIds).size) throw notFound();
      }
      const contract = await tx.contract.create({ data: { tenantId: context.tenantId, customerId: input.customerId, code: input.code, title: input.title, description: input.description, startDate: input.startDate, endDate: input.endDate, status: input.status, units: { create: [...new Set(input.unitIds)].map((unitId) => ({ tenantId: context.tenantId, unitId })) } } });
      await tx.auditLog.create({ data: audit(context, "contract.created", "Contract", contract.id) });
      return contract;
    });
  } catch (error) { mapOperationalError(error); }
}

export async function updateContract(context: OperationalContext, id: string, raw: unknown) {
  requirePermission(context.permissions, "contracts.update");
  const input = contractSchema.parse(raw);
  if (["SUSPENDED", "EXPIRED", "TERMINATED"].includes(input.status)) requirePermission(context.permissions, "contracts.disable");
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.contract.findFirst({ where: { id, tenantId: context.tenantId } });
      if (!current) throw notFound();
      if (current.status === "TERMINATED" && input.status !== "TERMINATED") throw new AppError("CONFLICT", "Contrato encerrado não pode ser reativado.");
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId: context.tenantId }, select: { id: true } });
      if (!customer) throw notFound();
      const uniqueUnits = [...new Set(input.unitIds)];
      if (uniqueUnits.length && await tx.unit.count({ where: { id: { in: uniqueUnits }, tenantId: context.tenantId } }) !== uniqueUnits.length) throw notFound();
      await tx.contract.updateMany({ where: { id, tenantId: context.tenantId }, data: { customerId: input.customerId, code: input.code, title: input.title, description: input.description, startDate: input.startDate, endDate: input.endDate, status: input.status } });
      await tx.contractUnit.deleteMany({ where: { contractId: id, tenantId: context.tenantId } });
      if (uniqueUnits.length) await tx.contractUnit.createMany({ data: uniqueUnits.map((unitId) => ({ tenantId: context.tenantId, contractId: id, unitId })) });
      await tx.auditLog.create({ data: audit(context, input.status === "SUSPENDED" ? "contract.suspended" : "contract.updated", "Contract", id, { status: input.status }) });
      return tx.contract.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    });
  } catch (error) { mapOperationalError(error); }
}

export async function listResourceCategories(context: OperationalContext) {
  requirePermission(context.permissions, "resource_categories.view");
  return prisma.resourceCategory.findMany({ where: { tenantId: context.tenantId }, orderBy: { name: "asc" } });
}

export async function createResourceCategory(context: OperationalContext, raw: unknown) {
  requirePermission(context.permissions, "resource_categories.manage");
  const input = resourceCategorySchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.resourceCategory.create({ data: { tenantId: context.tenantId, name: input.name, code: input.code, description: input.description, status: input.status } });
      await tx.auditLog.create({ data: audit(context, "resource_category.created", "ResourceCategory", category.id) });
      return category;
    });
  } catch (error) { mapOperationalError(error); }
}

export async function updateResourceCategory(context: OperationalContext, id: string, raw: unknown) {
  requirePermission(context.permissions, "resource_categories.manage");
  const input = resourceCategorySchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.resourceCategory.updateMany({ where: { id, tenantId: context.tenantId }, data: { name: input.name, code: input.code, description: input.description, status: input.status } });
      if (!result.count) throw notFound();
      await tx.auditLog.create({ data: audit(context, "resource_category.updated", "ResourceCategory", id, { status: input.status }) });
      return tx.resourceCategory.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    });
  } catch (error) { mapOperationalError(error); }
}

export async function listResources(context: OperationalContext, raw: unknown = {}) {
  requirePermission(context.permissions, "resources.view");
  const query = listQuerySchema.parse(raw);
  const where: Prisma.ResourceWhereInput = { tenantId: context.tenantId, ...(query.status ? { status: query.status as Prisma.EnumRecordStatusFilter } : {}), ...(query.search ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { code: { contains: query.search, mode: "insensitive" } }, { serialNumber: { contains: query.search, mode: "insensitive" } }] } : {}) };
  const [items, total] = await prisma.$transaction([prisma.resource.findMany({ where, include: { unit: { select: { name: true } }, category: { select: { name: true } } }, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.resource.count({ where })]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getResourceFormOptions(context: OperationalContext) {
  if (!context.permissions.has("resources.create") && !context.permissions.has("resources.update")) throw new AppError("FORBIDDEN", "Você não possui permissão para esta ação.");
  const [units, categories] = await Promise.all([
    prisma.unit.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.resourceCategory.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
  ]);
  return { units, categories };
}

export async function createResource(context: OperationalContext, raw: unknown) {
  requirePermission(context.permissions, "resources.create");
  const input = resourceSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const [unit, category] = await Promise.all([tx.unit.findFirst({ where: { id: input.unitId, tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true } }), tx.resourceCategory.findFirst({ where: { id: input.categoryId, tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true } })]);
      if (!unit || !category) throw notFound();
      const resource = await tx.resource.create({ data: { tenantId: context.tenantId, unitId: input.unitId, categoryId: input.categoryId, code: input.code, name: input.name, description: input.description, serialNumber: input.serialNumber, status: input.status, operationalStatus: input.operationalStatus } });
      await tx.auditLog.create({ data: audit(context, "resource.created", "Resource", resource.id) });
      return resource;
    });
  } catch (error) { mapOperationalError(error); }
}

export async function updateResource(context: OperationalContext, id: string, raw: unknown) {
  requirePermission(context.permissions, "resources.update");
  const input = resourceSchema.parse(raw);
  if (input.status !== "ACTIVE") requirePermission(context.permissions, "resources.disable");
  try {
    return await prisma.$transaction(async (tx) => {
      const [unit, category] = await Promise.all([tx.unit.findFirst({ where: { id: input.unitId, tenantId: context.tenantId }, select: { id: true } }), tx.resourceCategory.findFirst({ where: { id: input.categoryId, tenantId: context.tenantId }, select: { id: true } })]);
      if (!unit || !category) throw notFound();
      const result = await tx.resource.updateMany({ where: { id, tenantId: context.tenantId }, data: { unitId: input.unitId, categoryId: input.categoryId, code: input.code, name: input.name, description: input.description, serialNumber: input.serialNumber, status: input.status, operationalStatus: input.operationalStatus } });
      if (!result.count) throw notFound();
      await tx.auditLog.create({ data: audit(context, input.status === "ACTIVE" ? "resource.updated" : "resource.disabled", "Resource", id, { status: input.status, operationalStatus: input.operationalStatus }) });
      return tx.resource.findFirstOrThrow({ where: { id, tenantId: context.tenantId } });
    });
  } catch (error) { mapOperationalError(error); }
}
