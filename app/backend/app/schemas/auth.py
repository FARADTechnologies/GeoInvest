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
