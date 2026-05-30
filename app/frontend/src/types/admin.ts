export type UserRole = "super_admin" | "company_admin" | "employee";

export type EmployeeRole =
  | "Director"
  | "Manager"
  | "Data Scientist"
  | "Data Analyst"
  | "Sales"
  | "Viewer";

export type AccountRequest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  taxId: string;
  title: string;
  password: string;
  employeeCount?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type CompanyUser = {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  status: "active" | "blocked";
  lastLogin: string;
};

export type Company = {
  id: string;
  name: string;
  taxId: string;
  adminName: string;
  adminEmail: string;
  employeeCount: number;
  activeUsers: number;
  status: "active" | "blocked" | "trial";
  plan: string;
  lastLogin: string;
  users: CompanyUser[];
  auditLog: string[];
};
