import { Elysia, t } from 'elysia'
import { PostDrizzleService } from '../services/post-drizzle.service'
import { NotFoundError } from '../utils/errors'

const postService = new PostDrizzleService()

export const postRoutes = new Elysia({ prefix: '/api/posts' })
  .get('/', async () => {
    const posts = await postService.getAllPosts()
    return posts  // responseTransformer가 자동으로 CommonResponse로 변환
  })
  .post('/', async ({ body }) => {
    const post = await postService.createPost(body)
    return post  // responseTransformer가 자동으로 CommonResponse로 변환
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
      throw new NotFoundError('게시글을 찾을 수 없습니다.')
    }
    return post
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
      throw new NotFoundError('게시글을 찾을 수 없습니다.')
    }
    return { id: params.id }  // 삭제된 ID 반환
  }, {
    params: t.Object({
      id: t.String()
    })
  })