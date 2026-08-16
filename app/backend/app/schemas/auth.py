from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyOtpRequest(BaseModel):
    email: str
    code: str


class RegisterRequest(BaseModel):
    firstName: str
    lastName: str
    email: str
    password: str
    phone: str
    companyName: str
    taxId: str
    title: str
    employeeCount: str | None = None


class ApproveRequest(BaseModel):
    email: str
    # "active" approves the account, "rejected" turns it down.
    status: str = "active"


class RoleRequest(BaseModel):
    email: str
    role: str  # super_admin | company_admin | employee


class StatusRequest(BaseModel):
    email: str
    status: str  # active | blocked | rejected


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileRequest(BaseModel):
    name: str
