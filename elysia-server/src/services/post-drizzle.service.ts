import { desc, eq } from 'drizzle-orm'
import { db } from '../db/drizzle'
import { posts } from '../db/schema'
import type { CreatePostDto, UpdatePostDto } from '../models/post.model'

export class PostDrizzleService {
  async getAllPosts() {
    return await db.select().from(posts).orderBy(desc(posts.createdAt))
  }

  async getPostById(id: number) {
    const result = await db.select().from(posts).where(eq(posts.id, id))
    return result[0] || null
  }

  async createPost(data: CreatePostDto) {
    const result = await db
      .insert(posts)
      .values({
        title: data.title,
        content: data.content,
        author: data.author,
      })
      .returning()
    return result[0]
  }

  async updatePost(id: number, data: UpdatePostDto) {
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.content !== undefined) updateData.content = data.content
    if (data.author !== undefined) updateData.author = data.author

    if (Object.keys(updateData).length === 0) {
      return this.getPostById(id)
    }

    updateData.updatedAt = new Date()

    const result = await db.update(posts).set(updateData).where(eq(posts.id, id)).returning()

    return result[0] || null
  }

  async deletePost(id: number) {
    const result = await db.delete(posts).where(eq(posts.id, id)).returning()
    return result.length > 0
  }
}
