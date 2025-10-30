import { describe, expect, test } from "bun:test"
import {
  FILTERABLE_LEAD_FIELDS,
  type FilterableLeadField,
  type FilterOperator,
  LEAD_FIELD_TYPES,
  OPERATOR_FIELD_TYPE_MAP,
} from "./lead-filters.types"

describe("FilterOperator type", () => {
  test("all operators are valid strings", () => {
    const validOperators: FilterOperator[] = [
      "equals",
      "notEquals",
      "contains",
      "startsWith",
      "endsWith",
      "gt",
      "lt",
      "gte",
      "lte",
      "between",
      "in",
      "notIn",
      "isEmpty",
      "isNotEmpty",
    ]

    // This test ensures all operators are typed correctly
    expect(validOperators.length).toBe(14)
  })
})

describe("FILTERABLE_LEAD_FIELDS", () => {
  test("contains all expected lead fields", () => {
    const expectedFields: FilterableLeadField[] = [
      "companyName",
      "foundCompanyName",
      "contactName",
      "websiteUrl",
      "businessType",
      "description",
      "country",
      "city",
      "state",
      "address",
      "foundedYear",
      "employeeCount",
      "leadStatus",
      "leadScore",
      "leadSource",
      "notes",
      "createdBy",
      "createdAt",
      "updatedAt",
    ]

    expect(FILTERABLE_LEAD_FIELDS.length).toBe(19)
    for (const field of expectedFields) {
      expect(FILTERABLE_LEAD_FIELDS).toContain(field)
    }
  })

  test("all fields are unique", () => {
    const uniqueFields = new Set(FILTERABLE_LEAD_FIELDS)
    expect(uniqueFields.size).toBe(FILTERABLE_LEAD_FIELDS.length)
  })

  test("can be used as type guard", () => {
    const field = "companyName"
    const isFilterable = FILTERABLE_LEAD_FIELDS.includes(field as FilterableLeadField)
    expect(isFilterable).toBe(true)
  })

  test("rejects invalid fields", () => {
    const invalidField = "invalidField"
    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid field rejection
    const isFilterable = FILTERABLE_LEAD_FIELDS.includes(invalidField as any)
    expect(isFilterable).toBe(false)
  })
})

describe("LEAD_FIELD_TYPES", () => {
  test("all filterable fields have type mappings", () => {
    for (const field of FILTERABLE_LEAD_FIELDS) {
      const fieldType = LEAD_FIELD_TYPES[field]
      expect(fieldType).toBeDefined()
      if (fieldType) {
        expect(["string", "number", "date", "enum"]).toContain(fieldType)
      }
    }
  })

  test("string fields are correctly typed", () => {
    expect(LEAD_FIELD_TYPES.companyName).toBe("string")
    expect(LEAD_FIELD_TYPES.foundCompanyName).toBe("string")
    expect(LEAD_FIELD_TYPES.contactName).toBe("string")
    expect(LEAD_FIELD_TYPES.websiteUrl).toBe("string")
    expect(LEAD_FIELD_TYPES.businessType).toBe("string")
    expect(LEAD_FIELD_TYPES.description).toBe("string")
    expect(LEAD_FIELD_TYPES.country).toBe("string")
    expect(LEAD_FIELD_TYPES.city).toBe("string")
    expect(LEAD_FIELD_TYPES.state).toBe("string")
    expect(LEAD_FIELD_TYPES.address).toBe("string")
    expect(LEAD_FIELD_TYPES.employeeCount).toBe("string")
    expect(LEAD_FIELD_TYPES.leadSource).toBe("string")
    expect(LEAD_FIELD_TYPES.notes).toBe("string")
  })

  test("number fields are correctly typed", () => {
    expect(LEAD_FIELD_TYPES.foundedYear).toBe("number")
    expect(LEAD_FIELD_TYPES.leadScore).toBe("number")
  })

  test("date fields are correctly typed", () => {
    expect(LEAD_FIELD_TYPES.createdAt).toBe("date")
    expect(LEAD_FIELD_TYPES.updatedAt).toBe("date")
  })

  test("enum fields are correctly typed", () => {
    expect(LEAD_FIELD_TYPES.leadStatus).toBe("enum")
  })
})

describe("OPERATOR_FIELD_TYPE_MAP", () => {
  test("all field types have operator mappings", () => {
    expect(OPERATOR_FIELD_TYPE_MAP.string).toBeDefined()
    expect(OPERATOR_FIELD_TYPE_MAP.number).toBeDefined()
    expect(OPERATOR_FIELD_TYPE_MAP.date).toBeDefined()
    expect(OPERATOR_FIELD_TYPE_MAP.enum).toBeDefined()
  })

  test("string type has correct operators", () => {
    const stringOperators = OPERATOR_FIELD_TYPE_MAP.string
    expect(stringOperators).toContain("equals")
    expect(stringOperators).toContain("notEquals")
    expect(stringOperators).toContain("contains")
    expect(stringOperators).toContain("startsWith")
    expect(stringOperators).toContain("endsWith")
    expect(stringOperators).toContain("in")
    expect(stringOperators).toContain("notIn")
    expect(stringOperators).toContain("isEmpty")
    expect(stringOperators).toContain("isNotEmpty")

    // String should NOT have comparison operators
    expect(stringOperators).not.toContain("gt")
    expect(stringOperators).not.toContain("lt")
    expect(stringOperators).not.toContain("between")
  })

  test("number type has correct operators", () => {
    const numberOperators = OPERATOR_FIELD_TYPE_MAP.number
    expect(numberOperators).toContain("equals")
    expect(numberOperators).toContain("notEquals")
    expect(numberOperators).toContain("gt")
    expect(numberOperators).toContain("lt")
    expect(numberOperators).toContain("gte")
    expect(numberOperators).toContain("lte")
    expect(numberOperators).toContain("between")
    expect(numberOperators).toContain("isEmpty")
    expect(numberOperators).toContain("isNotEmpty")

    // Number should NOT have string operators
    expect(numberOperators).not.toContain("contains")
    expect(numberOperators).not.toContain("startsWith")
    expect(numberOperators).not.toContain("endsWith")
  })

  test("date type has correct operators", () => {
    const dateOperators = OPERATOR_FIELD_TYPE_MAP.date
    expect(dateOperators).toContain("equals")
    expect(dateOperators).toContain("notEquals")
    expect(dateOperators).toContain("gt")
    expect(dateOperators).toContain("lt")
    expect(dateOperators).toContain("gte")
    expect(dateOperators).toContain("lte")
    expect(dateOperators).toContain("between")

    // Date should NOT have string operators or isEmpty
    expect(dateOperators).not.toContain("contains")
    expect(dateOperators).not.toContain("isEmpty")
    expect(dateOperators).not.toContain("isNotEmpty")
  })

  test("enum type has correct operators", () => {
    const enumOperators = OPERATOR_FIELD_TYPE_MAP.enum
    expect(enumOperators).toContain("equals")
    expect(enumOperators).toContain("notEquals")
    expect(enumOperators).toContain("in")
    expect(enumOperators).toContain("notIn")

    // Enum should only have equality and membership operators
    expect(enumOperators).not.toContain("contains")
    expect(enumOperators).not.toContain("gt")
    expect(enumOperators).not.toContain("lt")
    expect(enumOperators).not.toContain("between")
  })

  test("operator compatibility validation", () => {
    // Test that string fields can use string operators
    const stringFieldType = LEAD_FIELD_TYPES.companyName
    if (stringFieldType) {
      const validOperators = OPERATOR_FIELD_TYPE_MAP[stringFieldType]
      expect(validOperators).toContain("contains")
    }

    // Test that number fields can use comparison operators
    const numberFieldType = LEAD_FIELD_TYPES.leadScore
    if (numberFieldType) {
      const numberOperators = OPERATOR_FIELD_TYPE_MAP[numberFieldType]
      expect(numberOperators).toContain("gt")
      expect(numberOperators).toContain("between")
    }

    // Test that enum fields can use in operator
    const enumFieldType = LEAD_FIELD_TYPES.leadStatus
    if (enumFieldType) {
      const enumOperators = OPERATOR_FIELD_TYPE_MAP[enumFieldType]
      expect(enumOperators).toContain("in")
    }
  })
})

describe("Type consistency", () => {
  test("all fields in LEAD_FIELD_TYPES are in FILTERABLE_LEAD_FIELDS", () => {
    const fieldTypesKeys = Object.keys(LEAD_FIELD_TYPES) as FilterableLeadField[]
    for (const field of fieldTypesKeys) {
      expect(FILTERABLE_LEAD_FIELDS).toContain(field)
    }
  })

  test("all fields in FILTERABLE_LEAD_FIELDS have type mappings", () => {
    for (const field of FILTERABLE_LEAD_FIELDS) {
      expect(LEAD_FIELD_TYPES[field]).toBeDefined()
    }
  })

  test("no duplicate field definitions", () => {
    const fieldTypesKeys = Object.keys(LEAD_FIELD_TYPES)
    const uniqueKeys = new Set(fieldTypesKeys)
    expect(uniqueKeys.size).toBe(fieldTypesKeys.length)
  })
})
