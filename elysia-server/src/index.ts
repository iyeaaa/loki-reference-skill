import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { PostDrizzleService } from './services/post-drizzle.service'

const postService = new PostDrizzleService()

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'Bulletin Board API',
        version: '1.0.0',
        description: 'Simple CRUD API for bulletin board'
      }
    }
  }))
  .get('/', () => 'Bulletin Board API')
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // CRUD Endpoints
  .get('/api/posts', async () => {
    try {
      const posts = await postService.getAllPosts()
      return { success: true, data: posts }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  .post('/api/posts', async ({ body }) => {
    try {
      const post = await postService.createPost(body)
      return { success: true, data: post }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 255 }),
      content: t.String({ minLength: 1 }),
      author: t.String({ minLength: 1, maxLength: 100 })
    })
  })

  .put('/api/posts/:id', async ({ params, body }) => {
    try {
      const post = await postService.updatePost(parseInt(params.id), body)
      if (!post) {
        return { success: false, error: 'Post not found' }
      }
      return { success: true, data: post }
    } catch (error) {
      return { success: false, error: error.message }
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

  .delete('/api/posts/:id', async ({ params }) => {
    try {
      const success = await postService.deletePost(parseInt(params.id))
      if (!success) {
        return { success: false, error: 'Post not found' }
      }
      return { success: true, message: 'Post deleted successfully' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  .listen(3001)

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)