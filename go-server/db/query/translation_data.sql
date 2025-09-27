-- name: GetTranslation :one
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
WHERE id = $1;

-- name: GetTranslationBySourceAndTarget :one
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
WHERE source_text = $1 AND target_language = $2
LIMIT 1;

-- name: ListTranslations :many
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListTranslationsByUser :many
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
WHERE created_by = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListTranslationsByLanguage :many
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
WHERE target_language = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateTranslation :one
INSERT INTO translation_data (
    source_text, target_language, translated_text, translation_engine, 
    redis_key, element_context, quality_confidence_score, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING id, source_text, target_language, translated_text, translation_engine, 
          redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at;

-- name: UpdateTranslation :one
UPDATE translation_data
SET translated_text = $2,
    translation_engine = $3,
    element_context = $4,
    quality_confidence_score = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, source_text, target_language, translated_text, translation_engine, 
          redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at;

-- name: UpdateTranslationContext :one
UPDATE translation_data
SET element_context = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, source_text, target_language, translated_text, translation_engine, 
          redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at;

-- name: DeleteTranslation :exec
DELETE FROM translation_data
WHERE id = $1;

-- name: SearchTranslations :many
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
WHERE source_text ILIKE '%' || $1 || '%' 
   OR translated_text ILIKE '%' || $1 || '%'
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetTranslationWithContext :many
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
WHERE element_context @> $1::jsonb
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetTranslationsByContextKey :many
SELECT id, source_text, target_language, translated_text, translation_engine, 
       redis_key, element_context, quality_confidence_score, created_by, created_at, updated_at
FROM translation_data
WHERE element_context->>'page' = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountAllTranslations :one
SELECT COUNT(*) as count
FROM translation_data;

-- name: CountTranslationsByLanguage :one
SELECT COUNT(*) as count
FROM translation_data
WHERE target_language = $1;

-- name: CountTranslationsBySearch :one
SELECT COUNT(*) as count
FROM translation_data
WHERE source_text ILIKE '%' || $1 || '%' 
   OR translated_text ILIKE '%' || $1 || '%';

-- name: CountTranslationsByUser :one
SELECT COUNT(*) as count
FROM translation_data
WHERE created_by = $1;

-- name: GetApprovedTranslation :one
SELECT td.translated_text, td.element_context
FROM translation_data td
JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE td.source_text = sqlc.arg(source_text)
AND td.target_language = sqlc.arg(target_language)
AND tr.review_status = 'approved'
LIMIT 1;

-- name: UpsertTranslation :one
INSERT INTO translation_data (
    source_text, target_language, translated_text, 
    translation_engine, redis_key, element_context, quality_confidence_score
) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (md5(source_text), target_language) 
DO UPDATE SET 
    translated_text = EXCLUDED.translated_text,
    element_context = EXCLUDED.element_context,
    quality_confidence_score = EXCLUDED.quality_confidence_score,
    updated_at = CURRENT_TIMESTAMP
RETURNING id;

-- name: CreateTranslationReview :exec
INSERT INTO translation_reviews (
    translation_id, review_status, priority
) VALUES ($1, $2, $3)
ON CONFLICT (translation_id) DO NOTHING;

-- name: GetTranslationReviewStatus :one
SELECT review_status
FROM translation_reviews
WHERE translation_id = $1;

-- name: UpdateTranslationReviewStatus :exec
UPDATE translation_reviews
SET review_status = $2,
    updated_at = CURRENT_TIMESTAMP
WHERE translation_id = $1;

-- name: ListTranslationsWithFilters :many
SELECT DISTINCT
    td.id, td.source_text, td.target_language, td.translated_text, 
    td.translation_engine, td.redis_key, td.element_context, 
    td.quality_confidence_score, td.created_by, td.created_at, td.updated_at
FROM translation_data td
LEFT JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE 
    ($1::text IS NULL OR td.source_text ILIKE '%' || $1 || '%' OR td.translated_text ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR td.target_language = $2)
    AND ($3::text IS NULL OR td.translation_engine = $3)
    AND ($4::review_status_enum IS NULL OR tr.review_status = $4)
ORDER BY td.created_at DESC
LIMIT $5 OFFSET $6;

-- name: CountTranslationsWithFilters :one
SELECT COUNT(DISTINCT td.id) as count
FROM translation_data td
LEFT JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE 
    ($1::text IS NULL OR td.source_text ILIKE '%' || $1 || '%' OR td.translated_text ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR td.target_language = $2)
    AND ($3::text IS NULL OR td.translation_engine = $3)
    AND ($4::review_status_enum IS NULL OR tr.review_status = $4);

-- name: ListTranslationsByReviewStatus :many
SELECT 
    td.id, td.source_text, td.target_language, td.translated_text, 
    td.translation_engine, td.redis_key, td.element_context, 
    td.quality_confidence_score, td.created_by, td.created_at, td.updated_at
FROM translation_data td
INNER JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE tr.review_status = $1
ORDER BY td.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountTranslationsByReviewStatus :one
SELECT COUNT(*) as count
FROM translation_data td
INNER JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE tr.review_status = $1;

-- name: ListTranslationsWithMultipleFilters :many
SELECT DISTINCT
    td.id, td.source_text, td.target_language, td.translated_text, 
    td.translation_engine, td.redis_key, td.element_context, 
    td.quality_confidence_score, td.created_by, td.created_at, td.updated_at
FROM translation_data td
LEFT JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE 
    ($1::text IS NULL OR $1 = '' OR td.source_text ILIKE '%' || $1 || '%' OR td.translated_text ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR $2 = '' OR td.target_language = ANY(string_to_array($2, ',')))
    AND ($3::text IS NULL OR $3 = '' OR td.translation_engine = ANY(string_to_array($3, ',')))
    AND ($4::text IS NULL OR $4 = '' OR tr.review_status::text = ANY(string_to_array($4, ',')))
ORDER BY td.created_at DESC
LIMIT $5 OFFSET $6;

-- name: CountTranslationsWithMultipleFilters :one
SELECT COUNT(DISTINCT td.id) as count
FROM translation_data td
LEFT JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE 
    ($1::text IS NULL OR $1 = '' OR td.source_text ILIKE '%' || $1 || '%' OR td.translated_text ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR $2 = '' OR td.target_language = ANY(string_to_array($2, ',')))
    AND ($3::text IS NULL OR $3 = '' OR td.translation_engine = ANY(string_to_array($3, ',')))
    AND ($4::text IS NULL OR $4 = '' OR tr.review_status::text = ANY(string_to_array($4, ',')));

-- name: ListUniqueSourceTextsWithFilters :many
SELECT DISTINCT ON (td.source_text)
    td.source_text,
    MAX(td.created_at) as latest_created_at
FROM translation_data td
LEFT JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE 
    ($1::text IS NULL OR $1 = '' OR td.source_text ILIKE '%' || $1 || '%' OR td.translated_text ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR $2 = '' OR td.target_language = ANY(string_to_array($2, ',')))
    AND ($3::text IS NULL OR $3 = '' OR td.translation_engine = ANY(string_to_array($3, ',')))
    AND ($4::text IS NULL OR $4 = '' OR tr.review_status::text = ANY(string_to_array($4, ',')))
GROUP BY td.source_text
ORDER BY td.source_text, latest_created_at DESC
LIMIT $5 OFFSET $6;

-- name: CountUniqueSourceTextsWithFilters :one
SELECT COUNT(DISTINCT source_text) as count
FROM translation_data td
LEFT JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE 
    ($1::text IS NULL OR $1 = '' OR td.source_text ILIKE '%' || $1 || '%' OR td.translated_text ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR $2 = '' OR td.target_language = ANY(string_to_array($2, ',')))
    AND ($3::text IS NULL OR $3 = '' OR td.translation_engine = ANY(string_to_array($3, ',')))
    AND ($4::text IS NULL OR $4 = '' OR tr.review_status::text = ANY(string_to_array($4, ',')));

-- name: GetTranslationsBySourceTexts :many
SELECT DISTINCT
    td.id, td.source_text, td.target_language, td.translated_text, 
    td.translation_engine, td.redis_key, td.element_context, 
    td.quality_confidence_score, td.created_by, td.created_at, td.updated_at,
    COALESCE(tr.review_status::text, 'pending') as review_status
FROM translation_data td
LEFT JOIN translation_reviews tr ON td.id = tr.translation_id
WHERE td.source_text = ANY($1::text[])
ORDER BY td.source_text, td.target_language;