import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  type AddressBookGroup,
  addressBookContacts,
  addressBookGroups,
  type NewAddressBookContact,
  type NewAddressBookGroup,
} from '../db/schema'

export async function createGroup(
  userId: string,
  data: Pick<NewAddressBookGroup, 'name' | 'description'>,
) {
  const [group] = await db
    .insert(addressBookGroups)
    .values({ userId, name: data.name, description: data.description ?? null })
    .returning()
  return group
}

export async function updateGroup(
  userId: string,
  id: string,
  data: Partial<Pick<AddressBookGroup, 'name' | 'description'>>,
) {
  const [group] = await db
    .update(addressBookGroups)
    .set({ name: data.name, description: data.description, updatedAt: new Date() })
    .where(and(eq(addressBookGroups.id, id), eq(addressBookGroups.userId, userId)))
    .returning()
  return group
}

export async function deleteGroup(userId: string, id: string) {
  await db
    .delete(addressBookGroups)
    .where(and(eq(addressBookGroups.id, id), eq(addressBookGroups.userId, userId)))
}

export async function listGroups(userId: string, limit: number, offset: number, search?: string) {
  const conditions = [eq(addressBookGroups.userId, userId)]
  if (search) {
    conditions.push(ilike(addressBookGroups.name, `%${search}%`))
  }
  const where = and(...conditions)

  const groups = await db
    .select()
    .from(addressBookGroups)
    .where(where)
    .orderBy(desc(addressBookGroups.createdAt))
    .limit(limit)
    .offset(offset)
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(addressBookGroups)
    .where(where)
  return { groups, total: countResult[0]?.count ?? 0 }
}

export async function addContact(
  userId: string,
  groupId: string,
  contact: Pick<
    NewAddressBookContact,
    | 'company'
    | 'email'
    | 'industryType'
    | 'productCategory'
    | 'description'
    | 'websiteUrl'
    | 'country'
    | 'linkedinUrl'
    | 'facebookUrl'
    | 'instagramUrl'
  >,
) {
  const [inserted] = await db
    .insert(addressBookContacts)
    .values({
      userId,
      groupId,
      company: contact.company,
      email: contact.email,
      industryType: contact.industryType,
      productCategory: contact.productCategory,
      description: contact.description,
      websiteUrl: contact.websiteUrl,
      country: contact.country,
      linkedinUrl: contact.linkedinUrl,
      facebookUrl: contact.facebookUrl,
      instagramUrl: contact.instagramUrl,
    })
    .returning()
  return inserted
}

export async function deleteContact(userId: string, contactId: string) {
  await db
    .delete(addressBookContacts)
    .where(and(eq(addressBookContacts.id, contactId), eq(addressBookContacts.userId, userId)))
}

export async function listContacts(
  userId: string,
  groupId: string,
  limit: number,
  offset: number,
  search?: string,
) {
  const conditions = [
    eq(addressBookContacts.userId, userId),
    eq(addressBookContacts.groupId, groupId),
  ]
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
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(addressBookContacts)
    .where(where)
  return { contacts, total: countResult[0]?.count ?? 0 }
}
