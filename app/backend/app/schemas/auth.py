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
    phone: str
    companyName: str
    taxId: str
    title: str
    employeeCount: str | None = None
