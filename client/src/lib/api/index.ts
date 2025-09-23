import { AuthApi } from "./auth";
import { LogsApi } from "./logs";
import { UsersApi } from "./users";

// 통합 API Client 클래스
class ApiClient {
	//   public dashboard: DashboardApi;
	public users: UsersApi;
	public auth: AuthApi;
	public logs: LogsApi;

	constructor() {
		// this.dashboard = new DashboardApi();
		this.users = new UsersApi();
		this.auth = new AuthApi();
		this.logs = new LogsApi();
	}
}

export const apiClient = new ApiClient();

// 타입 re-export
export * from "./types";

// 개별 API 클래스들도 export (필요시 직접 사용 가능)
export {
	//   DashboardApi,
	UsersApi,
	LogsApi,
	AuthApi,
};
