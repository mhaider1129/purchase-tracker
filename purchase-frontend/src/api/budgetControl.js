import api from "./axios";

export const fetchDepartmentBudgets = async (fiscalYear) => {
  const params = fiscalYear ? { fiscal_year: fiscalYear } : {};
  const response = await api.get("/budget-control", { params });
  return response.data?.data || [];
};

export const saveDepartmentBudget = async (payload) => {
  const response = await api.post("/budget-control", payload);
  return response.data?.data;
};