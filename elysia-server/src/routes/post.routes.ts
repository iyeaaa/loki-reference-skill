import { Elysia, t } from 'elysia'
import { PostDrizzleService } from '../services/post-drizzle.service'
import { NotFoundError } from '../utils/errors'

const postService = new PostDrizzleService()

export const postRoutes = new Elysia({ prefix: '/api/posts' })
  .get('/', async () => {
    const posts = await postService.getAllPosts()
    return { success: true, data: posts }
  })
  .post('/', async ({ body }) => {
    const post = await postService.createPost(body)
    return { success: true, data: post }
  }, {
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 255 }),
      content: t.String({ minLength: 1 }),
      author: t.String({ minLength: 1, maxLength: 100 })
    })
  })
  .put('/:id', async ({ params, body }) => {
    const post = await postService.updatePost(parseInt(params.id), body)
    if (!post) {
      throw new NotFoundError('Post not found')
    }
    return { success: true, data: post }
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
    const success = await postService.deletePost(parseInt(params.id))
    if (!success) {
      throw new NotFoundError('Post not found')
    }
    return { success: true, message: 'Post deleted successfully' }
  }, {
    params: t.Object({
      id: t.String()
    })
  })