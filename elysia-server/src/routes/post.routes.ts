import { Elysia, t } from 'elysia'
import { PostDrizzleService } from '../services/post-drizzle.service'

const postService = new PostDrizzleService()

export const postRoutes = new Elysia({ prefix: '/api/posts' })
  .get('/', async () => {
    try {
      const posts = await postService.getAllPosts()
      return { success: true, data: posts }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  })
  .post('/', async ({ body }) => {
    try {
      const post = await postService.createPost(body)
      return { success: true, data: post }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }, {
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 255 }),
      content: t.String({ minLength: 1 }),
      author: t.String({ minLength: 1, maxLength: 100 })
    })
  })
  .put('/:id', async ({ params, body }) => {
    try {
      const post = await postService.updatePost(parseInt(params.id), body)
      if (!post) {
        return { success: false, error: 'Post not found' }
      }
      return { success: true, data: post }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      title: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
      content: t.Optional(t.String({ minLength: 1 })),
      author: t.Optional(t.String({ minLength: 1, maxLength: 100 }))
    })
  })
  .delete('/:id', async ({ params }) => {
    try {
      const success = await postService.deletePost(parseInt(params.id))
      if (!success) {
        return { success: false, error: 'Post not found' }
      }
      return { success: true, message: 'Post deleted successfully' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })