package dto

type Todo struct {
	UserID    int    `json:"userId"`
	ID        int    `json:"id"`
	Content   string `json:"content"`
	Completed bool   `json:"completed"`
}

type TodosData struct {
	Todos []Todo `json:"todos"`
}

type TodosResponse struct {
	Message string    `json:"message"`
	Code    int       `json:"code"`
	Data    TodosData `json:"data"`
}