import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  addressBookContacts,
  addressBookGroups,
  type AddressBookGroup,
  type NewAddressBookContact,
  type NewAddressBookGroup,
} from '../db/schema'

export async function createGroup(data: Pick<NewAddressBookGroup, 'name' | 'description'>) {
  const [group] = await db
    .insert(addressBookGroups)
    .values({ name: data.name, description: data.description ?? null })
    .returning()
  return group
}

export async function updateGroup(id: string, data: Partial<Pick<AddressBookGroup, 'name' | 'description'>>) {
  const [group] = await db
    .update(addressBookGroups)
    .set({ name: data.name, description: data.description, updatedAt: new Date() })
    .where(eq(addressBookGroups.id, id))
    .returning()
  return group
}

export async function deleteGroup(id: string) {
  await db.delete(addressBookGroups).where(eq(addressBookGroups.id, id))
}

export async function listGroups(limit: number, offset: number, search?: string) {
  const where = search ? ilike(addressBookGroups.name, `%${search}%`) : undefined
  const groups = await db
    .select()
    .from(addressBookGroups)
    .where(where)
    .orderBy(desc(addressBookGroups.createdAt))
    .limit(limit)
    .offset(offset)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(addressBookGroups)
    .where(where)
  return { groups, total: count }
}

export async function addContact(groupId: string, contact: Pick<NewAddressBookContact, 'company' | 'email'>) {
  const [inserted] = await db
    .insert(addressBookContacts)
    .values({ groupId, company: contact.company, email: contact.email })
    .returning()
  return inserted
}

export async function deleteContact(contactId: string) {
  await db.delete(addressBookContacts).where(eq(addressBookContacts.id, contactId))
}

export async function listContacts(groupId: string, limit: number, offset: number, search?: string) {
  const conditions = [eq(addressBookContacts.groupId, groupId)]
  if (search) {
    conditions.push(ilike(addressBookContacts.company, `%${search}%`))
  }
  const where = and(...conditions)
  const contacts = await db
    .select()
    .from(addressBookContacts)
    .where(where)
    .orderBy(desc(addressBookContacts.createdAt))
    .limit(limit)
    .offset(offset)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(addressBookContacts)
    .where(where)
  return { contacts, total: count }
}


