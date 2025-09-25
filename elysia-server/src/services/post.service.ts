import { pool } from '../db/config'
import type { Post, CreatePostDto, UpdatePostDto } from '../models/post.model'

export class PostService {
  async getAllPosts(): Promise<Post[]> {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC')
    return result.rows
  }

  async getPostById(id: number): Promise<Post | null> {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async createPost(data: CreatePostDto): Promise<Post> {
    const { title, content, author } = data
    const result = await pool.query(
      'INSERT INTO posts (title, content, author) VALUES ($1, $2, $3) RETURNING *',
      [title, content, author]
    )
    return result.rows[0]
  }

  async updatePost(id: number, data: UpdatePostDto): Promise<Post | null> {
    const fields = []
    const values = []
    let paramCount = 1

    if (data.title !== undefined) {
      fields.push(`title = $${paramCount}`)
      values.push(data.title)
      paramCount++
    }

    if (data.content !== undefined) {
      fields.push(`content = $${paramCount}`)
      values.push(data.content)
      paramCount++
    }

    if (data.author !== undefined) {
      fields.push(`author = $${paramCount}`)
      values.push(data.author)
      paramCount++
    }

    if (fields.length === 0) {
      return this.getPostById(id)
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const query = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`
    const result = await pool.query(query, values)
    return result.rows[0] || null
  }

  async deletePost(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM posts WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }
}