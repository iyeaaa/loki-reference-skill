-- name: GetDepartment :one
SELECT * FROM departments
WHERE id = $1 LIMIT 1;

-- name: ListDepartments :many
SELECT * FROM departments
WHERE is_active = true
ORDER BY name COLLATE "ko-KR-x-icu";

-- name: ListAllDepartments :many
SELECT * FROM departments
ORDER BY name COLLATE "ko-KR-x-icu";

-- name: CreateDepartment :one
INSERT INTO departments (
  name,
  code,
  description,
  is_active
) VALUES (
  $1, $2, $3, $4
)
RETURNING *;

-- name: UpdateDepartment :one
UPDATE departments
SET
  name = $2,
  code = $3,
  description = $4,
  is_active = $5,
  updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: DeleteDepartment :exec
DELETE FROM departments
WHERE id = $1;

-- name: CountUsersByDepartment :one
SELECT COUNT(*) FROM users
WHERE department_id = $1;