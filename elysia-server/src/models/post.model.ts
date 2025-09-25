export interface Post {
  id?: number
  title: string
  content: string
  author: string
  created_at?: Date
  updated_at?: Date
}

export interface CreatePostDto {
  title: string
  content: string
  author: string
}

export interface UpdatePostDto {
  title?: string
  content?: string
  author?: string
}