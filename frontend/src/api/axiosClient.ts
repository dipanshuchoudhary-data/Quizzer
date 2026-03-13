import axios from "axios";
import { env } from "@/lib/env";

export const examAxiosClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 20_000,
});
