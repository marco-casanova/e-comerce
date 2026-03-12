import { httpClient } from "../../../core/api/httpClient";
import type { LoginPayload, LoginResponse } from "../types";

export const authApi = {
  login: (payload: LoginPayload) =>
    httpClient.post<LoginResponse>("/auth/login", payload),
};
