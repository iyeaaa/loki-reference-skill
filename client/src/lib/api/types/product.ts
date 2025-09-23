export interface Product {
	id: string;
	category_id: string;
	category_name?: string;
	category_path?: string;
	name: string;
	description?: string;
	features?: string;
	specifications?: Record<string, string>;
	is_featured?: boolean;
	is_active?: boolean;
	sort_order?: number;
	created_at?: string;
	updated_at?: string;
	media?: Array<{
		id: string;
		product_id: string;
		s3_file_id: string;
		file_url: string;
		file_name: string;
		file_size: number;
		media_type: string;
		is_primary: boolean;
		is_active: boolean;
		sort_order: number;
		created_at: string;
		updated_at: string;
	}>;
}
