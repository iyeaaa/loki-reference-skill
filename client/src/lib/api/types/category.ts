export interface Category {
	id: string;
	name: string;
	description?: string;
	parent_id?: string;
	path?: string;
	sort_order?: number;
	is_active?: boolean;
	created_at?: string;
	updated_at?: string;
}
