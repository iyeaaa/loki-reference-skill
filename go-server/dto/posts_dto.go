package dto

type Post struct {
	ID        int    `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	ImgURL    string `json:"imgUrl"`
	CreatedAt string `json:"createdAt"`
	UserID    int    `json:"userId"`
}

type PostsData struct {
	Posts []Post `json:"posts"`
}

type PostsResponse struct {
	Message string    `json:"message"`
	Code    int       `json:"code"`
	Data    PostsData `json:"data"`
}