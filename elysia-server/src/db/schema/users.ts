import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  index
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const userRoleEnum = pgEnum('user_role_enum', ['admin', 'user'])

// Departments table
export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  codeIdx: index('departments_code_idx').on(table.code),
  isActiveIdx: index('departments_is_active_idx').on(table.isActive)
}))

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  userRole: userRoleEnum('user_role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  employeeId: varchar('employee_id', { length: 20 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true })
}, (table) => ({
  departmentIdx: index('users_department_id_idx').on(table.departmentId)
}))

// Relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users)
}))

export const usersRelations = relations(users, ({ one }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id]
  })
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Department = typeof departments.$inferSelect
export type NewDepartment = typeof departments.$inferInsert