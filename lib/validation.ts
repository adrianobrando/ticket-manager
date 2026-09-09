import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const createTicketSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  type: z.enum(["modifica sito", "nuova grafica", "bug fix", "contenuti", "altro"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  clientName: nonEmptyString,
  clientEmail: z.email(),
  contractId: nonEmptyString.optional(),
  estimatedHours: z.number().finite().min(0).nullable().optional(),
  hourlyRate: z.number().finite().min(0).nullable().optional(),
  fixedPrice: z.number().finite().min(0).nullable().optional(),
  showPrice: z.boolean().optional(),
});

export const commentSchema = z.object({
  content: nonEmptyString,
  authorType: z.enum(["client", "admin"]),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(["new", "open", "in_progress", "completed", "cancelled"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    estimatedHours: z.number().finite().min(0).nullable().optional(),
    hourlyRate: z.number().finite().min(0).nullable().optional(),
    fixedPrice: z.number().finite().min(0).nullable().optional(),
    showPrice: z.boolean().optional(),
    actualHours: z.number().finite().min(0).optional(),
    contractId: nonEmptyString.nullable().optional(),
    // The admin form uses <input type="date"> (YYYY-MM-DD), while API
    // clients may send a full ISO datetime.
    dueDate: z.union([z.iso.date(), z.iso.datetime()]).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Nessun campo valido da aggiornare");

export const ticketFiltersSchema = z.object({
  status: z.enum(["new", "open", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const isoDateTime = z.union([z.iso.datetime(), z.iso.datetime({ local: true })]);
const dateOrDateTime = z.union([z.iso.date(), isoDateTime]);

export const createWorkLogSchema = z.object({
  date: dateOrDateTime,
  startTime: isoDateTime,
  endTime: isoDateTime,
  ticketId: nonEmptyString,
  notes: z.string().trim().optional(),
});

export const contractSchema = z.object({
  clientId: nonEmptyString,
  name: nonEmptyString,
  type: z.enum(["RETAINER", "HOURLY"]),
  monthlyHoursIncluded: z.number().finite().min(0).nullable().optional(),
  hourlyRate: z.number().finite().min(0),
  startDate: z.union([z.iso.date(), z.iso.datetime()]),
  endDate: z.union([z.iso.date(), z.iso.datetime()]).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const timeEntrySchema = z.object({
  ticketId: nonEmptyString,
  date: z.union([z.iso.date(), z.iso.datetime()]),
  startTime: z.union([z.iso.datetime(), z.iso.datetime({ local: true })]),
  endTime: z.union([z.iso.datetime(), z.iso.datetime({ local: true })]),
  note: z.string().trim().optional(),
});
