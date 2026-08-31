"use server";

import { revalidatePath } from "next/cache";
import {
  addCustomerAddress, addCustomerContact,
  createContract, createCustomer, createResource, createResourceCategory, createUnit,
  updateContract, updateCustomer, updateResource, updateResourceCategory, updateUnit,
} from "@/server/operational/operational-service";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";

const text = (form: FormData, name: string) => String(form.get(name) ?? "");
const optional = (form: FormData, name: string) => text(form, name).trim() || undefined;

function unitInput(form: FormData) {
  return { name: text(form, "name"), code: text(form, "code"), status: text(form, "status") || "ACTIVE", phone: optional(form, "phone"), email: optional(form, "email"), addressLine1: optional(form, "addressLine1"), addressLine2: optional(form, "addressLine2"), city: optional(form, "city"), state: optional(form, "state"), postalCode: optional(form, "postalCode"), country: text(form, "country") || "BR" };
}

export async function createUnitAction(form: FormData) { await createUnit(await getActiveTenantContext(), unitInput(form)); revalidatePath("/units"); }
export async function updateUnitAction(id: string, form: FormData) { await updateUnit(await getActiveTenantContext(), id, unitInput(form)); revalidatePath("/units"); }

function customerInput(form: FormData) {
  return { type: text(form, "type"), legalName: text(form, "legalName"), tradeName: optional(form, "tradeName"), document: optional(form, "document"), status: text(form, "status") || "ACTIVE", email: optional(form, "email"), phone: optional(form, "phone"), notes: optional(form, "notes") };
}

export async function createCustomerAction(form: FormData) { await createCustomer(await getActiveTenantContext(), customerInput(form)); revalidatePath("/customers"); }
export async function updateCustomerAction(id: string, form: FormData) { await updateCustomer(await getActiveTenantContext(), id, customerInput(form)); revalidatePath("/customers"); revalidatePath(`/customers/${id}`); }
export async function addCustomerContactAction(customerId: string, form: FormData) { await addCustomerContact(await getActiveTenantContext(), customerId, { name: text(form, "name"), title: optional(form, "title"), email: optional(form, "email"), phone: optional(form, "phone"), whatsapp: optional(form, "whatsapp"), isPrimary: form.get("isPrimary") === "on", status: "ACTIVE" }); revalidatePath(`/customers/${customerId}`); }
export async function addCustomerAddressAction(customerId: string, form: FormData) { await addCustomerAddress(await getActiveTenantContext(), customerId, { type: text(form, "type"), label: optional(form, "label"), addressLine1: text(form, "addressLine1"), addressLine2: optional(form, "addressLine2"), city: text(form, "city"), state: text(form, "state"), postalCode: text(form, "postalCode"), country: text(form, "country") || "BR", isPrimary: form.get("isPrimary") === "on", status: "ACTIVE" }); revalidatePath(`/customers/${customerId}`); }

function contractInput(form: FormData) {
  return { customerId: text(form, "customerId"), code: text(form, "code"), title: text(form, "title"), description: optional(form, "description"), startDate: text(form, "startDate"), endDate: optional(form, "endDate"), status: text(form, "status") || "DRAFT", unitIds: form.getAll("unitIds").map(String) };
}

export async function createContractAction(form: FormData) { await createContract(await getActiveTenantContext(), contractInput(form)); revalidatePath("/contracts"); }
export async function updateContractAction(id: string, form: FormData) { await updateContract(await getActiveTenantContext(), id, contractInput(form)); revalidatePath("/contracts"); }

function categoryInput(form: FormData) { return { name: text(form, "name"), code: text(form, "code"), description: optional(form, "description"), status: text(form, "status") || "ACTIVE" }; }
export async function createResourceCategoryAction(form: FormData) { await createResourceCategory(await getActiveTenantContext(), categoryInput(form)); revalidatePath("/resources"); }
export async function updateResourceCategoryAction(id: string, form: FormData) { await updateResourceCategory(await getActiveTenantContext(), id, categoryInput(form)); revalidatePath("/resources"); }

function resourceInput(form: FormData) { return { unitId: text(form, "unitId"), categoryId: text(form, "categoryId"), code: text(form, "code"), name: text(form, "name"), description: optional(form, "description"), serialNumber: optional(form, "serialNumber"), status: text(form, "status") || "ACTIVE", operationalStatus: text(form, "operationalStatus") || "AVAILABLE" }; }
export async function createResourceAction(form: FormData) { await createResource(await getActiveTenantContext(), resourceInput(form)); revalidatePath("/resources"); }
export async function updateResourceAction(id: string, form: FormData) { await updateResource(await getActiveTenantContext(), id, resourceInput(form)); revalidatePath("/resources"); }
