import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, Edit, Trash2, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Post {
  id: number
  title: string
  content: string
  author: string
  createdAt: string
  updatedAt: string
}

const API_URL = 'http://localhost:3001/api'

export default function BulletinBoardPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: ''
  })

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/posts`)
      const result = await response.json()
      if (result.success) {
        setPosts(result.data)
      } else {
        setError('Failed to fetch posts')
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
      setError('Connection error. Please check if the server is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (editingPost) {
        const response = await fetch(`${API_URL}/posts/${editingPost.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        const result = await response.json()
        if (result.success) {
          setPosts(posts.map(p => p.id === editingPost.id ? result.data : p))
          setEditingPost(null)
        } else {
          setError('Failed to update post')
        }
      } else {
        const response = await fetch(`${API_URL}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        const result = await response.json()
        if (result.success) {
          setPosts([result.data, ...posts])
        } else {
          setError('Failed to create post')
        }
      }
      setFormData({ title: '', content: '', author: '' })
    } catch (error) {
      console.error('Failed to save post:', error)
      setError('Failed to save post. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (post: Post) => {
    setEditingPost(post)
    setFormData({
      title: post.title,
      content: post.content,
      author: post.author
    })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this post?')) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/posts/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        setPosts(posts.filter(p => p.id !== id))
      } else {
        setError('Failed to delete post')
      }
    } catch (error) {
      console.error('Failed to delete post:', error)
      setError('Failed to delete post. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const cancelEdit = () => {
    setEditingPost(null)
    setFormData({ title: '', content: '', author: '' })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">게시판 테스트</h1>
        <div className="text-sm text-muted-foreground">
          Elysia + Drizzle ORM + PostgreSQL
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {editingPost ? '게시글 수정' : '새 게시글 작성'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                type="text"
                placeholder="게시글 제목을 입력하세요"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">작성자</Label>
              <Input
                id="author"
                type="text"
                placeholder="작성자 이름을 입력하세요"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                placeholder="게시글 내용을 입력하세요"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                {loading ? '처리 중...' : editingPost ? '수정하기' : '작성하기'}
              </Button>
              {editingPost && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  취소
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">게시글 목록</h2>
        {loading && posts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              로딩 중...
            </CardContent>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              아직 게시글이 없습니다. 첫 번째 게시글을 작성해보세요!
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle>{post.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      작성자: {post.author} • {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(post)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(post.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{post.content}</p>
                {post.updatedAt !== post.createdAt && (
                  <p className="text-xs text-muted-foreground mt-4">
                    수정됨: {new Date(post.updatedAt).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}